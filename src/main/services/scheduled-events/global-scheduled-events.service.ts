import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, combineLatest, concat, concatMap, defaultIfEmpty, filter, forkJoin, from, last, map, mergeMap, of, reduce, tap, throwIfEmpty, toArray, zip } from 'rxjs';
import { Between, EntityManager, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { IntegrationScheduledEventsService } from '@core/interfaces/integrations/integration-scheduled-events.abstract-service';
import { InviteeScheduledEvent } from '@core/interfaces/scheduled-events/invitee-scheduled-events.interface';
import { PageOption } from '@core/interfaces/page-option.interface';
import { CreatedCalendarEvent } from '@core/interfaces/integrations/created-calendar-event.interface';
import { CalendarIntegrationService } from '@core/interfaces/integrations/calendar-integration.abstract-service';
import { ScheduledEventSearchOption } from '@interfaces/scheduled-events/scheduled-event-search-option.type';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { HostProfile } from '@interfaces/scheduled-events/host-profile.interface';
import { EventsService } from '@services/events/events.service';
import { ScheduledEventsRedisRepository } from '@services/scheduled-events/scheduled-events.redis-repository';
import { UtilService } from '@services/util/util.service';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { NativeScheduledEventsService } from '@services/scheduled-events/native-scheduled-events.service';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { User } from '@entity/users/user.entity';
import { GoogleIntegrationScheduledEvent } from '@entity/integrations/google/google-integration-scheduled-event.entity';
import { CalendarIntegration } from '@entity/calendars/calendar-integration.entity';
import { AppleCalDAVIntegrationScheduledEvent } from '@entity/integrations/apple/apple-caldav-integration-scheduled-event.entity';
import { Contact } from '@entity/events/contact.entity';
import { Team } from '@entity/teams/team.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { Availability } from '@entity/availability/availability.entity';
import { ScheduledStatus } from '@entity/scheduled-events/scheduled-status.enum';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/scheduled-events/cannot-create-by-invalid-time-range.exception';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';

/**
 * TODO: Apply prototype design pattern
 */
@Injectable()
export class GlobalScheduledEventsService {

    constructor(
        private readonly integrationsServiceLocator: IntegrationsServiceLocator,
        private readonly utilService: UtilService,
        private readonly timeUtilService: TimeUtilService,
        private readonly eventsService: EventsService,
        private readonly nativeSchedulesService: NativeScheduledEventsService,
        private readonly notificationsService: NotificationsService,
        private readonly calendarIntegrationsServiceLocator: CalendarIntegrationsServiceLocator,
        private readonly scheduledEventsRedisRepository: ScheduledEventsRedisRepository,
        @InjectRepository(ScheduledEvent) private readonly scheduledEventRepository: Repository<ScheduledEvent>,
        @InjectRepository(GoogleIntegrationScheduledEvent) private readonly googleIntegrationScheduleRepository: Repository<GoogleIntegrationScheduledEvent>,
        @InjectRepository(AppleCalDAVIntegrationScheduledEvent) private readonly appleCalDAVIntegrationScheduleRepository: Repository<AppleCalDAVIntegrationScheduledEvent>,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {
        this.allIntegrationScheduledEventServices = this.integrationsServiceLocator.getAllIntegrationScheduledEventsService();
    }

    allIntegrationScheduledEventServices: IntegrationScheduledEventsService[];

    search(scheduledEventSearchOption: Partial<ScheduledEventSearchOption> & Partial<PageOption>): Observable<InviteeScheduledEvent[]> {

        this.logger.info({
            message: 'scheduled events are searched',
            scheduledEventSearchOption
        });

        const syncNativeScheduledEvents$ = this.nativeSchedulesService.search(scheduledEventSearchOption);

        const integrationScheduledEvents$ = concat(...this.allIntegrationScheduledEventServices.map(
            (_integrationScheduledEvnetService) =>
                _integrationScheduledEvnetService.search(
                    scheduledEventSearchOption
                )
        )).pipe(
            reduce(
                (_allScheduledEvents, _scheduledEvents) => _allScheduledEvents.concat(_scheduledEvents), [] as InviteeScheduledEvent[]
            )
        );

        return zip([
            syncNativeScheduledEvents$,
            integrationScheduledEvents$
        ]).pipe(
            map(([
                syncNativeScheduledEvents,
                integrationScheduledEvents
            ]) => syncNativeScheduledEvents.concat(integrationScheduledEvents))
        );
    }

    findOne(scheduleUUID: string): Observable<ScheduledEvent> {
        return from(this.scheduledEventRepository.findOneByOrFail({
            uuid: scheduleUUID
        })).pipe(
            mergeMap((scheduledEvent) => this.scheduledEventsRedisRepository.getScheduledEventBody(scheduledEvent.uuid)
                .pipe(
                    map((scheduledEventBody) => {
                        scheduledEvent.inviteeAnswers = scheduledEventBody.inviteeAnswers;
                        return scheduledEvent;
                    })
                )
            )
        );
    }

    create(
        teamWorkspace: string,
        eventUUID: string,
        newScheduledEvent: ScheduledEvent,
        team: Team,
        host: User,
        hostProfiles: HostProfile[],
        hostAvailability: Availability
    ): Observable<ScheduledEvent> {
        return this._create(
            this.scheduledEventRepository.manager,
            teamWorkspace,
            eventUUID,
            newScheduledEvent,
            team,
            host,
            hostProfiles,
            hostAvailability
        ).pipe(
            mergeMap((_createdSchedule) =>
                from(_createdSchedule.scheduledEventNotifications)
                    .pipe(
                        mergeMap((_scheduledEventNotification) =>
                            this.notificationsService.sendBookingComplete(
                                _scheduledEventNotification
                            )
                        ),
                        toArray(),
                        map(() => _createdSchedule)
                    )
            ),
            mergeMap((_createdSchedule) =>
                from(this.scheduledEventRepository.update(
                    _createdSchedule.id,
                    {
                        status: ScheduledStatus.CONFIRMED
                    }
                )).pipe(
                    map(() => _createdSchedule)
                )
            )
        );
    }

    _create(
        entityManager: EntityManager,
        teamWorkspace: string,
        eventUUID: string,
        newScheduledEvent: ScheduledEvent,
        team: Team,
        host: User,
        hostProfiles: HostProfile[],
        hostAvailability: Availability
    ): Observable<ScheduledEvent> {

        this.logger.info({
            message: 'Scheduled Event Creating is started',
            teamWorkspace,
            hostUser: host,
            hostProfiles: hostProfiles.length
        });

        const availabilityTimezone = hostAvailability.timezone;
        const _scheduledEventRepository = entityManager.getRepository(ScheduledEvent);

        const eventType$ = this.eventsService.findOneByTeamWorkspaceAndUUID(teamWorkspace, eventUUID);
        const contacts$ = eventType$.pipe(map((eventType) => eventType.contacts));
        const availabilityBody = {
            availableTimes: hostAvailability.availableTimes,
            overrides: hostAvailability.overrides
        } as AvailabilityBody;

        this.logger.info({
            message: 'Scheduled Event Initializing is completed. Trying to validate request times and integrated calendars',
            availabilityBody
        });

        const scheduledEvent$ = from(eventType$)
            .pipe(
                map((eventType) => this.utilService.getPatchedScheduledEvent(
                    team,
                    hostProfiles[0],
                    hostProfiles,
                    eventType,
                    newScheduledEvent,
                    teamWorkspace
                ))
            );

        const calendarIntegrationServices = this.calendarIntegrationsServiceLocator.getAllCalendarIntegrationServices();
        const conferenceLinkIntegrationServices = this.integrationsServiceLocator.getAllConferenceLinkIntegrationService();

        const loadedOutboundCalendarIntegration$ = from(calendarIntegrationServices)
            .pipe(
                concatMap(
                    (calendarIntegrationService) => calendarIntegrationService.findOne({
                        outboundWriteSync: true,
                        profileId: hostProfiles[0].profileId
                    })
                )
            );

        return zip([
            of(availabilityBody),
            scheduledEvent$,
            loadedOutboundCalendarIntegration$,
            contacts$
        ]).pipe(
            // TODO: Maybe we can replace tap operator after proving that it can stop data stream and throw to exception flow
            concatMap(
                ([
                    availabilityBody,
                    patchedScheduledEvent,
                    loadedOutboundCalendarIntegrationOrNull,
                    contacts
                ]) =>
                    this.validate(
                        patchedScheduledEvent,
                        availabilityTimezone,
                        availabilityBody,
                        loadedOutboundCalendarIntegrationOrNull
                    ).pipe(
                        map(() => [
                            patchedScheduledEvent,
                            loadedOutboundCalendarIntegrationOrNull,
                            contacts
                        ] as [ScheduledEvent, CalendarIntegration | null, Contact[]])
                    )
            ),
            tap(([
                patchedSchedule,
                loadedOutboundCalendarIntegrationOrNull
            ]) => {
                this.logger.info({
                    message: 'is loaded outbound calendar integration null ?',
                    patchedScheduleId: patchedSchedule.id,
                    loadedOutboundCalendarIntegrationOrNull: !!loadedOutboundCalendarIntegrationOrNull,
                    integrationVendor: loadedOutboundCalendarIntegrationOrNull?.getIntegrationVendor()
                });
            }),
            mergeMap(
                ([
                    patchedSchedule,
                    loadedOutboundCalendarIntegrationOrNull,
                    contacts
                ]) => {

                    let createdCalendarEventOrNull$: Observable<CreatedCalendarEvent | null> = of(null);
                    let calendarIntegrationServiceOrNull: CalendarIntegrationService | null = null;

                    if (loadedOutboundCalendarIntegrationOrNull) {

                        const outboundCalendarIntegrationVendor = loadedOutboundCalendarIntegrationOrNull.getIntegrationVendor();

                        calendarIntegrationServiceOrNull = this.calendarIntegrationsServiceLocator.getCalendarIntegrationService(outboundCalendarIntegrationVendor);

                        createdCalendarEventOrNull$ = from(
                            calendarIntegrationServiceOrNull.createCalendarEvent(
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
                            })
                        );
                    }

                    return combineLatest([
                        createdCalendarEventOrNull$,
                        from(conferenceLinkIntegrationServices)
                    ]).pipe(
                        mergeMap(([createdCalendarEvent, conferenceLinkIntegrationService]) => {
                            const integrationVendor = conferenceLinkIntegrationService.getIntegrationVendor();

                            const integrationFactory = this.integrationsServiceLocator.getIntegrationFactory(integrationVendor);

                            const loadedIntegration$ = from(integrationFactory.findOne({
                                profileId: hostProfiles[0].profileId
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
                                }),
                                defaultIfEmpty(null)
                            );
                        }),
                        mergeMap((createdCalendarEventOrNull) => {
                            this.logger.info({
                                message: 'calendarIntegrationServiceOrNull && loadedOutboundCalendarIntegrationOrNull && createdCalendarEventOrNull',
                                calendarIntegrationServiceOrNull,
                                loadedOutboundCalendarIntegrationOrNull,
                                createdCalendarEventOrNull
                            });
                            if (calendarIntegrationServiceOrNull && loadedOutboundCalendarIntegrationOrNull && createdCalendarEventOrNull) {
                                return from(calendarIntegrationServiceOrNull.patchCalendarEvent(
                                    loadedOutboundCalendarIntegrationOrNull.getIntegration(),
                                    loadedOutboundCalendarIntegrationOrNull,
                                    patchedSchedule,
                                    createdCalendarEventOrNull
                                ));
                            } else {
                                return of(null);
                            }
                        }),
                        map(() => patchedSchedule)
                    );
                }
            ),
            last()
        ).pipe(
            tap((patchedSchedule) => {
                this.logger.info({
                    message: 'Trying to create the scheduled event..',
                    patchedSchedule
                });
            }),
            map((patchedSchedule) => this.scheduledEventRepository.create(patchedSchedule)),
            mergeMap((patchedSchedule) => from(_scheduledEventRepository.save(patchedSchedule))),
            tap(() => {
                this.logger.info({
                    message: 'Saving the Scheduled event relation data. Trying to save the redis data..'
                });
            }),
            mergeMap((createdSchedule) =>
                this.scheduledEventsRedisRepository.save(createdSchedule.uuid, {
                    inviteeAnswers: newScheduledEvent.inviteeAnswers,
                    scheduledNotificationInfo: newScheduledEvent.scheduledNotificationInfo
                }).pipe(map((_createdScheduledEventBody) => {
                    createdSchedule.inviteeAnswers = _createdScheduledEventBody.inviteeAnswers ;
                    createdSchedule.scheduledNotificationInfo = _createdScheduledEventBody.scheduledNotificationInfo;

                    return createdSchedule;
                }))
            ),
            tap(() => {
                this.logger.info({
                    message: 'Booking is completed successfully'
                });
            })
        );
    }

    _update(
        entityManager: EntityManager,
        scheduleId: number,
        partialScheduledEvent: Partial<ScheduledEvent>
    ): Observable<boolean> {

        const _scheduleRepository = entityManager.getRepository(ScheduledEvent);

        return from(_scheduleRepository.update(scheduleId, partialScheduledEvent))
            .pipe(
                map((updateResult) => !!updateResult.affected && updateResult.affected > 0)
            );
    }

    validate(
        scheduledEvent: ScheduledEvent,
        availabilityTimezone: string,
        availabilityBody: AvailabilityBody,
        calendarIntegrationOrNull?: CalendarIntegration | null
    ): Observable<ScheduledEvent> {

        const { scheduledTime, scheduledBufferTime } = scheduledEvent;
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
                eventId: scheduledEvent.eventId
            }
        );

        // investigate to find conflicted schedules
        const loadedSchedules$ = from(this.scheduledEventRepository.findOneBy(
            scheduleConditionOptions
        ));

        const scheduleObservables = [loadedSchedules$] as Array<Observable<ScheduledEvent | GoogleIntegrationScheduledEvent | AppleCalDAVIntegrationScheduledEvent | null>>;

        if (calendarIntegrationOrNull) {

            const integrationVendor = calendarIntegrationOrNull.getIntegrationVendor();

            let vendorIntegrationIdCondition;
            let repository: Repository<GoogleIntegrationScheduledEvent> | Repository<AppleCalDAVIntegrationScheduledEvent>;

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
                throw new BadRequestException('Unsupported integration vendor type for scheduled event validation');
            }

            const vendorIntegrationScheduleConditionOptions = this._getScheduleConflictCheckOptions(
                ensuredStartDateTime,
                ensuredEndDateTime,
                vendorIntegrationIdCondition
            );
            const loadedVendorIntegrationSchedules$ = from(
                repository.findOneBy(
                    vendorIntegrationScheduleConditionOptions
                )
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
            filter(([loadedScheduleOrNull, loadedVendorIntegrationScheduleOrNull]) => !loadedScheduleOrNull && !loadedVendorIntegrationScheduleOrNull),
            map(() => scheduledEvent),
            throwIfEmpty(() => new CannotCreateByInvalidTimeRange())
        );
    }

    _getScheduleConflictCheckOptions(
        startDateTime: Date,
        endDateTime: Date,
        additionalOptionsWhere?: FindOptionsWhere<ScheduledEvent> |
            FindOptionsWhere<GoogleIntegrationScheduledEvent> |
            FindOptionsWhere<AppleCalDAVIntegrationScheduledEvent>
        | undefined,
        options = {
            exclusivly: true
        }
    ): Array<FindOptionsWhere<InviteeScheduledEvent>> {

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
