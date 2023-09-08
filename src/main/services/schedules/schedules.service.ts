import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, defer, forkJoin, from, iif, map, mergeMap, of, throwError } from 'rxjs';
import { Between, EntityManager, FindOptionsWhere, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { calendar_v3 } from 'googleapis';
import { InviteeSchedule } from '@core/interfaces/schedules/invitee-schedule.interface';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { ScheduledEventSearchOption } from '@interfaces/schedules/scheduled-event-search-option.interface';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { UtilService } from '@services/util/util.service';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { ZoomIntegrationFacade } from '@services/integrations/zoom-integrations/zoom-integrations.facade';
import { Schedule } from '@entity/schedules/schedule.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { User } from '@entity/users/user.entity';
import { OverridedAvailabilityTime } from '@entity/availability/overrided-availability-time.entity';
import { AvailableTime } from '@entity/availability/availability-time.entity';
import { TimeRange } from '@entity/events/time-range.entity';
import { InviteeAnswer } from '@entity/schedules/invitee-answer.entity';
import { ConferenceLink } from '@entity/schedules/conference-link.entity';
import { ZoomIntegration } from '@entity/integrations/zoom/zoom-integration.entity';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/schedules/cannot-create-by-invalid-time-range.exception';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';
import { MeetingType } from '@app/interfaces/integrations/zoom/enum/meeting-type.enum';
import { ZoomCreateMeetingResponseDTO } from '@app/interfaces/integrations/zoom/zoom-create-meeting-response.interface';

@Injectable()
export class SchedulesService {

    constructor(
        private readonly utilService: UtilService,
        private readonly eventsService: EventsService,
        private readonly scheduleRedisRepository: SchedulesRedisRepository,
        private readonly googleCalendarIntegrationsService: GoogleCalendarIntegrationsService,
        private readonly integrationsServiceLocator: IntegrationsServiceLocator,
        private readonly availabilityRedisRepository: AvailabilityRedisRepository,
        @InjectRepository(Schedule) private readonly scheduleRepository: Repository<Schedule>,
        @InjectRepository(GoogleIntegrationSchedule) private readonly googleIntegrationScheduleRepository: Repository<GoogleIntegrationSchedule>,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    search(scheduleSearchOption: Partial<ScheduledEventSearchOption>): Observable<InviteeSchedule[]> {

        const {
            hostUUID,
            eventUUID,
            since,
            until
        } = scheduleSearchOption;

        const defaultUntilDateTime = new Date(new Date().getDate() + 90);
        const ensuredSinceDateTime = since ? new Date(since) : new Date();
        const ensuredUntilDateTime = until ? new Date(until) : defaultUntilDateTime;

        const scheduledEventDefaultOption: FindOptionsWhere<Schedule> = {
            eventDetail: {
                event: {
                    uuid: eventUUID
                }
            },
            host: {
                uuid: hostUUID
            }
        };
        const scheduleConditionOptions: Array<FindOptionsWhere<Schedule>> = [
            {
                scheduledTime: {
                    startTimestamp: MoreThanOrEqual(ensuredSinceDateTime),
                    endTimestamp: LessThanOrEqual(ensuredUntilDateTime)
                },
                ...scheduledEventDefaultOption
            },
            {
                scheduledBufferTime: {
                    startBufferTimestamp: MoreThanOrEqual(ensuredSinceDateTime),
                    endBufferTimestamp: LessThanOrEqual(ensuredUntilDateTime)
                },
                ...scheduledEventDefaultOption
            }
        ];

        const googleScheduledEventFindOption: FindOptionsWhere<GoogleIntegrationSchedule> = {
            host: {
                uuid: hostUUID
            }
        };

        const googleScheduleConditionOptions: Array<FindOptionsWhere<Schedule>> = [
            {
                scheduledTime: {
                    startTimestamp: MoreThanOrEqual(ensuredSinceDateTime),
                    endTimestamp: LessThanOrEqual(ensuredUntilDateTime)
                },
                ...googleScheduledEventFindOption
            },
            {
                scheduledBufferTime: {
                    startBufferTimestamp: MoreThanOrEqual(ensuredSinceDateTime),
                    endBufferTimestamp: LessThanOrEqual(ensuredUntilDateTime)
                },
                ...googleScheduledEventFindOption
            }
        ];

        const inviteeSchedule$ = defer(() => from(this.scheduleRepository.findBy(scheduleConditionOptions)));

        const googleIntegrationSchedule$ = defer(() => from(this.googleIntegrationScheduleRepository.findBy(googleScheduleConditionOptions)));

        return forkJoin([inviteeSchedule$, googleIntegrationSchedule$]).pipe(
            map(([inviteeSchedules, googleCalendarSchedules]) => [...inviteeSchedules, ...googleCalendarSchedules])
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

    create(userWorkspace: string, eventUUID: string, newSchedule: Schedule, host: User): Observable<Schedule> {
        return this._create(
            this.scheduleRepository.manager,
            userWorkspace,
            eventUUID,
            newSchedule,
            host
        );
    }

    _create(
        entityManager: EntityManager,
        userWorkspace: string,
        eventUUID: string,
        newSchedule: Schedule,
        host: User
    ): Observable<Schedule> {

        const _scheduleRepository = entityManager.getRepository(Schedule);

        const loadedEventByUserWorkspace$ = from(
            this.eventsService.findOneByUserWorkspaceAndUUID(userWorkspace, eventUUID)
        );

        const loadedGoogleCalendarIntegration$ = from(this.googleCalendarIntegrationsService.findOne({
            outboundWriteSync: true,
            userId: host.id
        }));

        const zoomIntegrationService = this.integrationsServiceLocator.getService(IntegrationVendor.ZOOM);
        const zoomIntegrationFacade: ZoomIntegrationFacade = this.integrationsServiceLocator.getFacade(IntegrationVendor.ZOOM) as ZoomIntegrationFacade;

        const loadedZoomIntegration$ = from(zoomIntegrationService.findOne({
            userId: host.id
        }));

        return loadedEventByUserWorkspace$.pipe(
            mergeMap(
                (event) => forkJoin([
                    this.availabilityRedisRepository.getAvailabilityBody(host.uuid, event.availability.uuid),
                    of(this.utilService.getPatchedScheduledEvent(
                        host,
                        event,
                        newSchedule,
                        userWorkspace,
                        event.availability.timezone
                    )),
                    loadedGoogleCalendarIntegration$,
                    loadedZoomIntegration$,
                    of(event.availability.timezone),
                    of(event.contacts)
                ])
            ),
            mergeMap(
                ([
                    availabilityBody,
                    patchedSchedule,
                    loadedGoogleCalendarIntegrationOrNull,
                    loadedZoomIntegrationOrNull,
                    availabilityTimezone,
                    contacts
                ]) =>
                    this.validate(
                        patchedSchedule,
                        availabilityTimezone,
                        availabilityBody,
                        loadedGoogleCalendarIntegrationOrNull?.id
                    ).pipe(
                        mergeMap((patchedSchedule) =>
                            loadedZoomIntegrationOrNull && contacts.find((_contact) => _contact.type === ContactType.ZOOM) ?
                                from(
                                    zoomIntegrationFacade.issueTokenByRefreshToken((loadedZoomIntegrationOrNull as ZoomIntegration).refreshToken)
                                ).pipe(
                                    mergeMap((oauth2UserToken) => zoomIntegrationFacade.createMeeting(oauth2UserToken.accessToken, {
                                        agenda: patchedSchedule.name,
                                        default_password: false,
                                        duration: '2',
                                        timezone: availabilityTimezone,
                                        type: MeetingType.Scheduled,
                                        topic: patchedSchedule.name,
                                        start_time: patchedSchedule.scheduledTime.startTimestamp
                                    })),
                                    mergeMap((createdZoomMeeting) => {

                                        const conferenceLink = this.getZoomMeetLink(createdZoomMeeting);

                                        patchedSchedule.conferenceLinks = [ conferenceLink ];

                                        return of(patchedSchedule);
                                    })
                                ) :
                                of(patchedSchedule)
                        ),
                        mergeMap((patchedSchedule) =>
                            loadedGoogleCalendarIntegrationOrNull ?
                                from(this.googleCalendarIntegrationsService.createGoogleCalendarEvent(
                                    (loadedGoogleCalendarIntegrationOrNull).googleIntegration,
                                    (loadedGoogleCalendarIntegrationOrNull),
                                    availabilityTimezone,
                                    patchedSchedule
                                )).pipe(mergeMap((createdGoogleCalendarEvent) => {

                                    patchedSchedule.iCalUID = createdGoogleCalendarEvent.iCalUID as string;

                                    const hasGoogleMeetLink = patchedSchedule.contacts.find((_contact) => _contact.type === ContactType.GOOGLE_MEET);

                                    if (hasGoogleMeetLink) {

                                        const googleConferenceLink = this.getGoogleMeetLink(createdGoogleCalendarEvent);

                                        if (patchedSchedule.conferenceLinks) {
                                            patchedSchedule.conferenceLinks.push(googleConferenceLink);
                                        } else {
                                            patchedSchedule.conferenceLinks = [ googleConferenceLink ];
                                        }

                                        return from(this.googleCalendarIntegrationsService.patchGoogleCalendarEvent(
                                            (loadedGoogleCalendarIntegrationOrNull).googleIntegration,
                                            (loadedGoogleCalendarIntegrationOrNull),
                                            createdGoogleCalendarEvent.id as string,
                                            patchedSchedule
                                        ));
                                    } else {
                                        return of(patchedSchedule);
                                    }
                                }), map(() => patchedSchedule)) :
                                of(patchedSchedule)
                        ),
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
                    )
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

    getGoogleMeetLink(createdGoogleCalendarEvent: calendar_v3.Schema$Event): ConferenceLink {

        const googleMeetConferenceLink = createdGoogleCalendarEvent.conferenceData as calendar_v3.Schema$ConferenceData;
        const generatedGoogleMeetLink = (googleMeetConferenceLink.entryPoints as calendar_v3.Schema$EntryPoint[])[0].uri;
        const convertedConferenceLink: ConferenceLink = {
            type: IntegrationVendor.GOOGLE,
            serviceName: 'Google Meet',
            link: generatedGoogleMeetLink
        };

        return convertedConferenceLink;
    }

    getZoomMeetLink(createdZoomMeeting: ZoomCreateMeetingResponseDTO): ConferenceLink {

        const convertedConferenceLink: ConferenceLink = {
            type: IntegrationVendor.ZOOM,
            serviceName: 'Zoom',
            link: createdZoomMeeting.join_url
        };

        return convertedConferenceLink;
    }

    validate(
        schedule: Schedule,
        availabilityTimezone: string,
        availabilityBody: AvailabilityBody,
        googleCalendarIntegrationId?: number | undefined
    ): Observable<Schedule> {

        const { scheduledTime, scheduledBufferTime } = schedule;
        const { startBufferTimestamp, endBufferTimestamp } = scheduledBufferTime;
        const { startTimestamp, endTimestamp } = scheduledTime;

        const ensuredBufferStartDatetime = startBufferTimestamp && new Date(startBufferTimestamp);
        const ensuredBufferEndDatetime = endBufferTimestamp && new Date(endBufferTimestamp);

        // for exclusive query, reduce 1 second
        const ensuredStartDateTime = ensuredBufferStartDatetime ?? new Date(startTimestamp);
        ensuredStartDateTime.setSeconds(ensuredStartDateTime.getSeconds() + 1);
        const ensuredStartDateTimestamp = ensuredStartDateTime.getTime();

        const ensuredEndDateTime = ensuredBufferEndDatetime ?? new Date(endTimestamp);
        ensuredEndDateTime.setSeconds(ensuredEndDateTime.getSeconds() - 1);
        const ensuredEndDateTimestamp = ensuredEndDateTime.getTime();

        const isNotConcatenatedTimes = ensuredEndDateTimestamp <= ensuredStartDateTimestamp;
        const isPast = this._isPastTimestamp(ensuredStartDateTimestamp, ensuredEndDateTimestamp);

        const { availableTimes, overrides } = availabilityBody;

        const isInvalidTimeOverlappingWithOverrides = this._isInvalidTimeOverlappingWithOverrides(
            availabilityTimezone,
            overrides,
            ensuredStartDateTimestamp,
            ensuredEndDateTimestamp
        );

        const isTimeOverlappingWithAvailableTimes = this._isTimeOverlappingWithAvailableTimes(
            availableTimes,
            availabilityTimezone,
            ensuredStartDateTime,
            ensuredEndDateTime
        );
        console.log('isTimeOverlappingWithAvailableTimes:', isTimeOverlappingWithAvailableTimes);
        const isNotTimeOverlappingWithAvailableTimes = !isTimeOverlappingWithAvailableTimes;

        const isInvalid = isPast || isNotConcatenatedTimes || isInvalidTimeOverlappingWithOverrides || isNotTimeOverlappingWithAvailableTimes;

        if (isInvalid) {

            const results = `isPast: ${String(isPast)},
            isNotConcatenatedTimes: ${String(isNotConcatenatedTimes)},
            (isInvalidTimeOverlappingWithOverrides && isNotTimeOverlappingWithAvailableTimes: ${String(isInvalidTimeOverlappingWithOverrides)}
                && ${String(isNotTimeOverlappingWithAvailableTimes)}`;

            this.logger.debug(
                `invalid reason: ${results}`
            );
            throw new CannotCreateByInvalidTimeRange();
        }

        const googleIntegrationScheduleConditionOptions = this._getScheduleConflictCheckOptions(
            ensuredStartDateTime,
            ensuredEndDateTime,
            {
                googleCalendarIntegrationId
            }
        );
        const loadedGoogleIntegrationSchedules$ = defer(() => from(
            this.googleIntegrationScheduleRepository.findOneBy(
                googleIntegrationScheduleConditionOptions
            ))
        );

        const loadedSchedules$ = defer(() => from(this.scheduleRepository.findOneBy(
            [
                {
                    scheduledTime: {
                        startTimestamp: MoreThanOrEqual(ensuredStartDateTime),
                        endTimestamp: LessThanOrEqual(ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledTime: {
                        startTimestamp: LessThanOrEqual(ensuredStartDateTime),
                        endTimestamp: MoreThanOrEqual(ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledBufferTime: {
                        startBufferTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledBufferTime: {
                        endBufferTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledTime: {
                        startTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                },
                {
                    scheduledTime: {
                        endTimestamp: Between(ensuredStartDateTime, ensuredEndDateTime)
                    },
                    eventDetailId: schedule.eventDetailId
                }
            ]
        )));

        const scheduleObservables = googleCalendarIntegrationId ?
            [loadedSchedules$, loadedGoogleIntegrationSchedules$] :
            [loadedSchedules$];

        return forkJoin(scheduleObservables).pipe(
            mergeMap(([loadedScheduleOrNull, loadedGoogleIntegrationScheduleOrNull]) =>
                iif(
                    () => {
                        this.logger.debug({
                            message: 'a previous engagement is detected: !loadedScheduleOrNull && !loadedGoogleIntegrationScheduleOrNull is true',
                            loadedScheduleOrNull,
                            loadedGoogleIntegrationScheduleOrNull
                        });
                        return !loadedScheduleOrNull && !loadedGoogleIntegrationScheduleOrNull;
                    },
                    of(schedule),
                    throwError(() => new CannotCreateByInvalidTimeRange())
                )
            )
        );
    }

    _getScheduleConflictCheckOptions(
        startDateTime: Date,
        endDateTime: Date,
        additionalOption?: FindOptionsWhere<GoogleIntegrationSchedule> | undefined
    ): Array<FindOptionsWhere<InviteeSchedule>> {
        return [
            {
                scheduledTime: {
                    startTimestamp: MoreThanOrEqual(startDateTime),
                    endTimestamp: LessThanOrEqual(endDateTime)
                },
                ...additionalOption
            },
            {
                scheduledTime: {
                    startTimestamp: LessThanOrEqual(startDateTime),
                    endTimestamp: MoreThanOrEqual(endDateTime)
                },
                ...additionalOption
            },
            {
                scheduledBufferTime: {
                    startBufferTimestamp: Between(startDateTime, endDateTime)
                },
                ...additionalOption
            },
            {
                scheduledBufferTime: {
                    endBufferTimestamp: Between(startDateTime, endDateTime)
                },
                ...additionalOption
            },
            {
                scheduledTime: {
                    startTimestamp: Between(startDateTime, endDateTime)
                },
                ...additionalOption
            },
            {
                scheduledTime: {
                    endTimestamp: Between(startDateTime, endDateTime)
                },
                ...additionalOption
            }
        ];
    }

    _isPastTimestamp(startDateTimestamp: number, ensuredEndDateTimestamp: number): boolean {
        return startDateTimestamp < Date.now() ||
            ensuredEndDateTimestamp < Date.now();
    }

    /**
     * This method returns true if given params are valid
     * nor returns false for invalid
     *
     * @param timezone
     * @param overrides
     * @param startDateTimestamp
     * @param endDateTimestamp
     * @returns true: invalid / false: valid
     */
    _isInvalidTimeOverlappingWithOverrides(
        timezone: string,
        overrides: OverridedAvailabilityTime[],
        startDateTimestamp: number,
        endDateTimestamp: number
    ): boolean {

        let isInvalidOverlappingWithOverrides: boolean;

        if (overrides.length > 0) {
            isInvalidOverlappingWithOverrides = false;

            for (const override of overrides) {
                // check available time
                const { targetDate: _targetDate } = override;
                // check unavailable time
                const _dateStartTime = '00:00';
                const _dateEndTime = '23:59';

                const _localizedDateStartTime = this.utilService.localizeDateTime(
                    new Date(_targetDate),
                    timezone,
                    _dateStartTime
                );
                const _localizedDateEndTime = this.utilService.localizeDateTime(
                    new Date(_targetDate),
                    timezone,
                    _dateEndTime
                );
                const isOverlapping = (_localizedDateStartTime.getTime() < startDateTimestamp && startDateTimestamp < _localizedDateEndTime.getTime()) ||
                (_localizedDateStartTime.getTime() < endDateTimestamp && endDateTimestamp < _localizedDateEndTime.getTime());

                if (isOverlapping) {
                    isInvalidOverlappingWithOverrides = true;

                    const canBeScheduled = override.timeRanges.some((__timeRange) => {
                        const {
                            startTime,
                            endTime
                        } = __timeRange as {
                            startTime: string;
                            endTime: string;
                        };
                        const _startDateTime = this.utilService.localizeDateTime(
                            new Date(_targetDate),
                            timezone,
                            startTime
                        );
                        const _endDateTime = this.utilService.localizeDateTime(
                            new Date(_targetDate),
                            timezone,
                            endTime
                        );
                        return _startDateTime.getTime() <= startDateTimestamp &&
                            endDateTimestamp <= _endDateTime.getTime();
                    });

                    if (canBeScheduled) {
                        isInvalidOverlappingWithOverrides = false;
                        break;
                    } else {
                        continue;
                    }

                } else {
                    isInvalidOverlappingWithOverrides = false;
                }
            }
        } else {
            isInvalidOverlappingWithOverrides = false;
        }

        return isInvalidOverlappingWithOverrides;
    }

    _isTimeOverlappingWithAvailableTimes(
        availableTimes: AvailableTime[],
        availabilityTimezone: string,
        startDateTime: Date,
        endDateTime: Date
    ): boolean {

        const startTimeString = this.utilService.dateToTimeString(startDateTime, availabilityTimezone);
        const endTimeString = this.utilService.dateToTimeString(endDateTime, availabilityTimezone);

        const localizedStartDateTime = this.utilService.localizeDateTime(
            startDateTime,
            availabilityTimezone,
            startTimeString
        );

        const localizedEndDateTime = this.utilService.localizeDateTime(
            endDateTime,
            availabilityTimezone,
            endTimeString
        );

        const localizedDate = Intl.DateTimeFormat([], {
            timeZone: availabilityTimezone,
            day: '2-digit'
        }).format(new Date(localizedStartDateTime));

        let startWeekday: number;
        let endWeekday: number;

        if (+localizedDate !== localizedStartDateTime.getDate()) {
            startWeekday = (localizedStartDateTime.getDay() + 1) % 7;
            endWeekday = (localizedEndDateTime.getDay() + 1) % 7;
        } else {
            startWeekday = localizedStartDateTime.getDay();
            endWeekday = localizedEndDateTime.getDay();
        }

        const startWeekdayAvailableTime = availableTimes.find((_availableTime) => _availableTime.day === startWeekday);
        const endWeekdayAvailableTime = availableTimes.find((_availableTime) => _availableTime.day === endWeekday);

        let isTimeOverlapping;

        if (startWeekdayAvailableTime && endWeekdayAvailableTime) {
            const isTimeOverlappingWithStartDateTime = this._isTimeOverlappingWithAvailableTimeRange(
                localizedStartDateTime,
                availabilityTimezone,
                startWeekdayAvailableTime.timeRanges
            );
            const isTimeOverlappingWithEndDateTime = this._isTimeOverlappingWithAvailableTimeRange(
                localizedStartDateTime,
                availabilityTimezone,
                endWeekdayAvailableTime.timeRanges
            );

            isTimeOverlapping = isTimeOverlappingWithStartDateTime && isTimeOverlappingWithEndDateTime;
        } else {
            isTimeOverlapping = false;
        }

        return isTimeOverlapping;
    }

    _isTimeOverlappingWithAvailableTimeRange(dateTime: Date, timezone: string, timeRanges: TimeRange[]): boolean {

        const isTimeOverlappingDateTime = timeRanges.some((_timeRange) => {
            const {
                startTime: timeRangeStartTime,
                endTime: timeRangeEndTime
            } = _timeRange as { startTime: string; endTime: string };

            const localizedTimeRangeStartDateTime = this.utilService.localizeDateTime(
                dateTime,
                timezone,
                timeRangeStartTime
            );

            const localizedTimeRangeEndDateTime = this.utilService.localizeDateTime(
                dateTime,
                timezone,
                timeRangeEndTime
            );

            return localizedTimeRangeStartDateTime.getTime() <= dateTime.getTime() &&
                dateTime.getTime() <= localizedTimeRangeEndDateTime.getTime();
        });

        return isTimeOverlappingDateTime;
    }
}
