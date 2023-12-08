import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, bufferCount, combineLatest, concatMap, defer, forkJoin, from, last, map, mergeMap, of, tap } from 'rxjs';
import { Between, EntityManager, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { InviteeSchedule } from '@core/interfaces/schedules/invitee-schedule.interface';
import { IntegrationSchedulesService } from '@core/interfaces/integrations/integration-schedules.abstract-service';
import { ScheduledEventSearchOption } from '@interfaces/schedules/scheduled-event-search-option.interface';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { UtilService } from '@services/util/util.service';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { NativeSchedulesService } from '@services/schedules/native-schedules.service';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { Schedule } from '@entity/schedules/schedule.entity';
import { User } from '@entity/users/user.entity';
import { InviteeAnswer } from '@entity/schedules/invitee-answer.entity';
import { GoogleIntegrationSchedule } from '@entity/integrations/google/google-integration-schedule.entity';
import { CalendarIntegration } from '@entity/calendars/calendar-integration.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { Contact } from '@entity/events/contact.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/schedules/cannot-create-by-invalid-time-range.exception';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';

/**
 * TODO: Apply prototype design pattern
 */
@Injectable()
export class GlobalSchedulesService {

    constructor(
        private readonly integrationsServiceLocator: IntegrationsServiceLocator,
        private readonly utilService: UtilService,
        private readonly timeUtilService: TimeUtilService,
        private readonly eventsService: EventsService,
        private readonly nativeSchedulesService: NativeSchedulesService,
        private readonly calendarIntegrationsServiceLocator: CalendarIntegrationsServiceLocator,
        private readonly scheduleRedisRepository: SchedulesRedisRepository,
        private readonly availabilityRedisRepository: AvailabilityRedisRepository,
        @InjectRepository(Schedule) private readonly scheduleRepository: Repository<Schedule>,
        @InjectRepository(GoogleIntegrationSchedule) private readonly googleIntegrationScheduleRepository: Repository<GoogleIntegrationSchedule>,
        @InjectRepository(AppleCalDAVIntegrationSchedule) private readonly appleCalDAVIntegrationScheduleRepository: Repository<AppleCalDAVIntegrationSchedule>,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {
        this.allIntegrationSchedulesServices = this.integrationsServiceLocator.getAllIntegrationSchedulesService();
    }

    allIntegrationSchedulesServices: IntegrationSchedulesService[];

    search(scheduleSearchOption: Partial<ScheduledEventSearchOption>): Observable<InviteeSchedule[]> {

        const syncNativeSchedule$ = this.nativeSchedulesService.search(scheduleSearchOption);

        const integrationSchedules$ = this.allIntegrationSchedulesServices.map(
            (_integrationSchedulesService) =>
                _integrationSchedulesService.search(
                    scheduleSearchOption
                )
        );

        return forkJoin([syncNativeSchedule$].concat(integrationSchedules$)).pipe(
            map(
                (allSchedulesArray) =>
                    allSchedulesArray.reduce(
                        (_allSchedules, _schedules) => _allSchedules.concat(_schedules), []
                    )
            )
        );
    }

    findOne(scheduleUUID: string): Observable<Schedule> {
        return from(this.scheduleRepository.findOneByOrFail({
            uuid: scheduleUUID
        })).pipe(
            mergeMap((scheduledEvent) => this.scheduleRedisRepository.getScheduleBody(scheduledEvent.uuid)
                .pipe(
                    map((scheduleBody) => {
                        scheduledEvent.inviteeAnswers = scheduleBody.inviteeAnswers;
                        return scheduledEvent;
                    })
                )
            )
        );
    }

    create(
        teamWorkspace: string,
        eventUUID: string,
        newSchedule: Schedule,
        host: User,
        hostProfile: Profile
    ): Observable<Schedule> {
        return this._create(
            this.scheduleRepository.manager,
            teamWorkspace,
            eventUUID,
            newSchedule,
            host,
            hostProfile
        );
    }

    _create(
        entityManager: EntityManager,
        teamWorkspace: string,
        eventUUID: string,
        newSchedule: Schedule,
        host: User,
        hostProfile: Profile
    ): Observable<Schedule> {

        const _scheduleRepository = entityManager.getRepository(Schedule);

        const loadedEventByTeamWorkspace$ = from(
            this.eventsService.findOneByTeamWorkspaceAndUUID(teamWorkspace, eventUUID)
        );

        const calendarIntegrationServices = this.calendarIntegrationsServiceLocator.getAllCalendarIntegrationServices();
        const conferenceLinkIntegrationServices = this.integrationsServiceLocator.getAllConferenceLinkIntegrationService();

        const loadedOutboundCalendarIntegration$ = from(calendarIntegrationServices)
            .pipe(
                concatMap(
                    (calendarIntegrationService) => calendarIntegrationService.findOne({
                        outboundWriteSync: true,
                        profileId: hostProfile.id
                    })
                )
            );

        return loadedEventByTeamWorkspace$.pipe(
            concatMap(
                (event) => combineLatest([
                    this.availabilityRedisRepository.getAvailabilityBody(host.uuid, event.availability.uuid),
                    of(this.utilService.getPatchedScheduledEvent(
                        host,
                        hostProfile,
                        event,
                        newSchedule,
                        teamWorkspace,
                        event.availability.timezone
                    )),
                    loadedOutboundCalendarIntegration$,
                    of(event.availability.timezone),
                    of(event.contacts)
                ])
            ),
            // TODO: Maybe we can replace tap operator after proving that it can stop data stream and throw to exception flow
            concatMap(
                ([
                    availabilityBody,
                    patchedSchedule,
                    loadedOutboundCalendarIntegrationOrNull,
                    availabilityTimezone,
                    contacts
                ]) =>
                    this.validate(
                        patchedSchedule,
                        availabilityTimezone,
                        availabilityBody,
                        loadedOutboundCalendarIntegrationOrNull
                    ).pipe(
                        map(() => [
                            patchedSchedule,
                            loadedOutboundCalendarIntegrationOrNull,
                            availabilityTimezone,
                            contacts
                        ] as [Schedule, CalendarIntegration | null, string, Contact[]])
                    )
            ),
            /**
             * Buffer validations for preventing invalid scheduling.
             */
            bufferCount(calendarIntegrationServices.length),
            concatMap((buffers) => from(buffers)),
            mergeMap(
                ([
                    patchedSchedule,
                    loadedOutboundCalendarIntegrationOrNull,
                    availabilityTimezone,
                    contacts
                ]) => {

                    if (!loadedOutboundCalendarIntegrationOrNull) {
                        return of(patchedSchedule);
                    } else {

                        const outboundCalendarIntegrationVendor = loadedOutboundCalendarIntegrationOrNull.getIntegrationVendor();

                        const calendarIntegrationService = this.calendarIntegrationsServiceLocator.getCalendarIntegrationService(outboundCalendarIntegrationVendor);

                        return from(
                            calendarIntegrationService.createCalendarEvent(
                                (loadedOutboundCalendarIntegrationOrNull).getIntegration(),
                                (loadedOutboundCalendarIntegrationOrNull),
                                availabilityTimezone,
                                patchedSchedule
                            )
                        ).pipe(
                            map((createdCalendarEvent) => {

                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                patchedSchedule.iCalUID = (createdCalendarEvent as any).iCalUID as string;

                                return createdCalendarEvent;
                            }),
                            mergeMap((createdCalendarEvent) => from(conferenceLinkIntegrationServices)
                                .pipe(
                                    mergeMap(
                                        (conferenceLinkIntegrationService) => {
                                            const integrationVendor = conferenceLinkIntegrationService.getIntegrationVendor();

                                            const integrationFactory = this.integrationsServiceLocator.getIntegrationFactory(integrationVendor);

                                            const loadedIntegration$ = from(integrationFactory.findOne({
                                                profileId: hostProfile.id
                                            }));

                                            return loadedIntegration$.pipe(
                                                mergeMap((loadedIntegration) => {

                                                    const createMeeting$ = loadedIntegration ?
                                                        from(conferenceLinkIntegrationService.createMeeting(
                                                            loadedIntegration,
                                                            contacts,
                                                            patchedSchedule,
                                                            availabilityTimezone,
                                                            createdCalendarEvent
                                                        )) : of(null);

                                                    return createMeeting$;
                                                }),
                                                mergeMap((createdConferenceLink) => {

                                                    if (createdConferenceLink) {
                                                        patchedSchedule.conferenceLinks.push(createdConferenceLink);
                                                    }

                                                    return of(createdCalendarEvent);
                                                })
                                            );
                                        }
                                    )
                                )),
                            mergeMap((createdCalendarEvent) => from(calendarIntegrationService.patchCalendarEvent(
                                loadedOutboundCalendarIntegrationOrNull.getIntegration(),
                                loadedOutboundCalendarIntegrationOrNull,
                                patchedSchedule,
                                createdCalendarEvent
                            )).pipe(
                                map(() => patchedSchedule)
                            ))
                        );
                    }
                }
            ),
            last(),
            mergeMap((patchedSchedule) => from(_scheduleRepository.save(patchedSchedule))),
            mergeMap((createdSchedule) =>
                this.scheduleRedisRepository.save(createdSchedule.uuid, {
                    inviteeAnswers: newSchedule.inviteeAnswers,
                    scheduledNotificationInfo: newSchedule.scheduledNotificationInfo
                }).pipe(map((_createdScheduleBody) => {
                    createdSchedule.inviteeAnswers = _createdScheduleBody.inviteeAnswers as InviteeAnswer[];
                    createdSchedule.scheduledNotificationInfo = _createdScheduleBody.scheduledNotificationInfo;

                    return createdSchedule;
                }))
            )
        );
    }

    _update(
        entityManager: EntityManager,
        scheduleId: number,
        partialSchedule: Partial<Schedule>
    ): Observable<boolean> {

        const _scheduleRepository = entityManager.getRepository(Schedule);

        return from(_scheduleRepository.update(scheduleId, partialSchedule))
            .pipe(
                map((updateResult) => !!updateResult.affected && updateResult.affected > 0)
            );
    }

    validate(
        schedule: Schedule,
        availabilityTimezone: string,
        availabilityBody: AvailabilityBody,
        calendarIntegrationOrNull?: CalendarIntegration | null
    ): Observable<Schedule> {

        const { scheduledTime, scheduledBufferTime } = schedule;
        const { startBufferTimestamp, endBufferTimestamp } = scheduledBufferTime;
        const { startTimestamp, endTimestamp } = scheduledTime;

        const ensuredBufferStartDatetime = startBufferTimestamp && new Date(startBufferTimestamp);
        const ensuredBufferEndDatetime = endBufferTimestamp && new Date(endBufferTimestamp);

        // for exclusive query, reduce 1 second
        const ensuredStartDateTime = ensuredBufferStartDatetime ?? new Date(startTimestamp);
        const ensuredStartDateTimestamp = ensuredStartDateTime.getTime();

        const ensuredEndDateTime = ensuredBufferEndDatetime ?? new Date(endTimestamp);
        const ensuredEndDateTimestamp = ensuredEndDateTime.getTime();

        const isNotConcatenatedTimes = ensuredEndDateTimestamp <= ensuredStartDateTimestamp;
        const isPast = this.timeUtilService.isPastTimestamp(ensuredStartDateTimestamp, ensuredEndDateTimestamp);

        const { availableTimes, overrides } = availabilityBody;

        const overlappingDateOverride = this.timeUtilService.findOverlappingDateOverride(
            availabilityTimezone,
            overrides,
            ensuredStartDateTimestamp,
            ensuredEndDateTimestamp
        );

        let isInvalidTimeOverlappingWithOverrides = true;
        let isInvalidTimeOverlappingWithAvailableTimes = true;
        let _isUnavailableDateOverride;
        let _isTimeOverlappingWithAvailableTimeOverrides;
        let _isTimeOverlappingWithAvailableTimes;

        if (overlappingDateOverride) {

            isInvalidTimeOverlappingWithAvailableTimes = false;

            // checking unavailable override
            _isUnavailableDateOverride = overlappingDateOverride.timeRanges.length === 0;

            if (_isUnavailableDateOverride) {
                isInvalidTimeOverlappingWithOverrides = true;
            } else {
                // or checking available override time match
                _isTimeOverlappingWithAvailableTimeOverrides = this.timeUtilService.isTimeOverlappingWithAvailableTimeOverrides(
                    availabilityTimezone,
                    overlappingDateOverride,
                    ensuredStartDateTimestamp,
                    ensuredEndDateTimestamp
                );

                isInvalidTimeOverlappingWithOverrides = !_isTimeOverlappingWithAvailableTimeOverrides;
            }

        } else {

            isInvalidTimeOverlappingWithOverrides = false;

            // checking available time
            _isTimeOverlappingWithAvailableTimes = this.timeUtilService.isTimeOverlappingWithAvailableTimes(
                availableTimes,
                availabilityTimezone,
                ensuredStartDateTime,
                ensuredEndDateTime
            );
            isInvalidTimeOverlappingWithAvailableTimes = !_isTimeOverlappingWithAvailableTimes;
        }

        const isInvalid = isPast || isNotConcatenatedTimes || isInvalidTimeOverlappingWithOverrides || isInvalidTimeOverlappingWithAvailableTimes;

        if (isInvalid) {

            this.logger.info({
                isPast,
                isNotConcatenatedTimes,
                isInvalidTimeOverlappingWithOverrides,
                _isUnavailableDateOverride,
                _isTimeOverlappingWithAvailableTimeOverrides,
                isInvalidTimeOverlappingWithAvailableTimes,
                availabilityTimezone,
                ensuredStartDateTime,
                ensuredEndDateTime
            });

            throw new CannotCreateByInvalidTimeRange();
        }

        const scheduleConditionOptions = this._getScheduleConflictCheckOptions(
            ensuredStartDateTime,
            ensuredEndDateTime,
            {
                eventDetailId: schedule.eventDetailId
            }
        );

        // investigate to find conflicted schedules
        const loadedSchedules$ = defer(() => from(this.scheduleRepository.findOneBy(
            scheduleConditionOptions
        )));

        const scheduleObservables = [loadedSchedules$] as Array<Observable<Schedule | GoogleIntegrationSchedule | AppleCalDAVIntegrationSchedule | null>>;

        if (calendarIntegrationOrNull) {

            const integrationVendor = calendarIntegrationOrNull.getIntegrationVendor();

            let vendorIntegrationIdCondition;
            let repository: Repository<GoogleIntegrationSchedule> | Repository<AppleCalDAVIntegrationSchedule>;

            if (integrationVendor === IntegrationVendor.GOOGLE) {
                repository = this.googleIntegrationScheduleRepository;
                vendorIntegrationIdCondition = {
                    googleCalendarIntegrationId: calendarIntegrationOrNull.id
                };
            } else if (integrationVendor === IntegrationVendor.APPLE) {
                repository = this.appleCalDAVIntegrationScheduleRepository;
                vendorIntegrationIdCondition = {
                    appleCalDAVCalendarIntegrationId: calendarIntegrationOrNull.id
                };

            } else {
                throw new BadRequestException('Unsupported integration vendor type for schedule validation');
            }

            const vendorIntegrationScheduleConditionOptions = this._getScheduleConflictCheckOptions(
                ensuredStartDateTime,
                ensuredEndDateTime,
                vendorIntegrationIdCondition
            );
            const loadedVendorIntegrationSchedules$ = defer(() => from(
                repository.findOneBy(
                    vendorIntegrationScheduleConditionOptions
                ))
            );
            scheduleObservables.push(loadedVendorIntegrationSchedules$);
        }

        return forkJoin(scheduleObservables).pipe(
            tap(([loadedScheduleOrNull, loadedVendorIntegrationScheduleOrNull]) => {
                this.logger.debug({
                    message: 'a previous engagement is detected: !loadedScheduleOrNull && !loadedVendorIntegrationScheduleOrNull is true',
                    loadedScheduleOrNull,
                    loadedVendorIntegrationScheduleOrNull
                });
            }),
            map(([loadedScheduleOrNull, loadedVendorIntegrationScheduleOrNull]) => {
                const _isValidSchedule = !loadedScheduleOrNull && !loadedVendorIntegrationScheduleOrNull;

                if (_isValidSchedule) {
                    return schedule;
                } else {
                    throw new CannotCreateByInvalidTimeRange();
                }
            })
        );
    }

    _getScheduleConflictCheckOptions(
        startDateTime: Date,
        endDateTime: Date,
        additionalOptionsWhere?: FindOptionsWhere<Schedule> |
            FindOptionsWhere<GoogleIntegrationSchedule> |
            FindOptionsWhere<AppleCalDAVIntegrationSchedule>
        | undefined,
        options = {
            exclusivly: true
        }
    ): Array<FindOptionsWhere<InviteeSchedule>> {

        const _startDateTime = new Date(startDateTime);
        const _endDateTime = new Date(endDateTime);

        if (options.exclusivly) {
            _startDateTime.setSeconds(_startDateTime.getSeconds() + 1);
            _endDateTime.setSeconds(_startDateTime.getSeconds() - 1);
        }

        return [
            {
                scheduledTime: {
                    startTimestamp: MoreThanOrEqual(_startDateTime),
                    endTimestamp: LessThanOrEqual(_endDateTime)
                },
                ...additionalOptionsWhere
            },
            {
                scheduledTime: {
                    startTimestamp: LessThanOrEqual(_startDateTime),
                    endTimestamp: MoreThanOrEqual(_endDateTime)
                },
                ...additionalOptionsWhere
            },
            {
                scheduledBufferTime: {
                    startBufferTimestamp: Between(_startDateTime, _endDateTime)
                },
                ...additionalOptionsWhere
            },
            {
                scheduledBufferTime: {
                    endBufferTimestamp: Between(_startDateTime, _endDateTime)
                },
                ...additionalOptionsWhere
            },
            {
                scheduledTime: {
                    startTimestamp: Between(_startDateTime, _endDateTime)
                },
                ...additionalOptionsWhere
            },
            {
                scheduledTime: {
                    endTimestamp: Between(_startDateTime, _endDateTime)
                },
                ...additionalOptionsWhere
            }
        ];
    }
}
