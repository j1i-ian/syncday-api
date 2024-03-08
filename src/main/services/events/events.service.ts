import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { Observable, defer, firstValueFrom, forkJoin, from, map, mergeMap } from 'rxjs';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Event } from '@core/entities/events/event.entity';
import { EventDetail } from '@core/entities/events/event-detail.entity';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { UtilService } from '@services/util/util.service';
import { EventStatus } from '@entity/events/event-status.enum';
import { EventGroup } from '@entity/events/event-group.entity';
import { EventProfile } from '@entity/events/event-profile.entity';
import { User } from '@entity/users/user.entity';
import { EventsSearchOption } from '@app/interfaces/events/events-search-option.interface';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { AlreadyUsedInEventLinkException } from '@app/exceptions/events/already-used-in-event-link.exception';
import { NoDefaultAvailabilityException } from '@app/exceptions/availability/no-default-availability.exception';
import { Validator } from '@criteria/validator';

@Injectable()
export class EventsService {
    constructor(
        private readonly validator: Validator,
        private readonly eventRedisRepository: EventsRedisRepository,
        private readonly utilService: UtilService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        @InjectDataSource() private datasource: DataSource,
        @InjectRepository(EventGroup) private readonly eventGroupRepository: Repository<EventGroup>,
        @InjectRepository(Event) private readonly eventRepository: Repository<Event>,
        @InjectRepository(EventProfile) private readonly eventProfileRepository: Repository<EventProfile>
    ) {}

    search(searchOption: EventsSearchOption): Observable<Event[]> {
        return defer(() => from(
            this.eventRepository.find({
                relations: {
                    eventGroup: {
                        team: {
                            teamSetting: true
                        }
                    },
                    eventDetail: true,
                    eventProfiles: {
                        profile: true
                    }
                },
                where: {
                    status: searchOption.status,
                    public: searchOption.public,
                    eventGroup: {
                        team: {
                            id: searchOption.teamId,
                            teamSetting: {
                                workspace: searchOption.teamWorkspace
                            }
                        }
                    }
                },
                order: {
                    priority: 'DESC'
                }
            })
        )).pipe(
            // TODO: should be refactored
            mergeMap((_events) => {
                const eventDetailUUIDs = _events.map((_event) => _event.eventDetail.uuid);

                return this.eventRedisRepository.getEventDetailRecords(eventDetailUUIDs)
                    .pipe(
                        map((eventDetailsRecord) => _events.map((__event) => {
                            const eventDetailBody = eventDetailsRecord[__event.eventDetail.uuid];

                            __event.eventDetail = {
                                ...__event.eventDetail,
                                ...eventDetailBody
                            };
                            return __event;
                        }))
                    );
            })
        );
    }

    findOne(eventId: number, teamId: number): Observable<Event> {
        return defer(() => from(
            this.validator.validate(teamId, eventId, Event)
        )).pipe(
            mergeMap(() =>
                this.eventRepository.findOneOrFail({
                    relations: ['eventDetail'],
                    where: {
                        id: eventId
                    }
                })),
            mergeMap((loadedEvent) => {
                const eventDetail = loadedEvent.eventDetail;
                const eventDetailUUID = eventDetail.uuid;

                return forkJoin({
                    hostQuestions:
                        this.eventRedisRepository.getHostQuestions(eventDetailUUID),
                    notificationInfo: this.eventRedisRepository.getNotificationInfo(eventDetailUUID),
                    eventSetting: this.eventRedisRepository.getEventSetting(eventDetailUUID)
                }).pipe(
                    map(({ hostQuestions, notificationInfo, eventSetting }) => {
                        loadedEvent.eventDetail.hostQuestions = hostQuestions;
                        loadedEvent.eventDetail.notificationInfo = notificationInfo;
                        loadedEvent.eventDetail.eventSetting = eventSetting;
                        return loadedEvent;
                    })
                );
            })
        );
    }

    findOneByTeamWorkspaceAndUUID(teamWorkspace: string, eventUUID: string): Observable<Event> {
        return defer(() => from(
            this.eventRepository.findOneOrFail({
                relations: {
                    eventDetail: true,
                    eventGroup: {
                        team: {
                            teamSetting: true
                        }
                    }
                },
                where: {
                    uuid: eventUUID,
                    status: EventStatus.OPENED,
                    eventGroup: {
                        team: {
                            teamSetting: {
                                workspace: teamWorkspace
                            }
                        }
                    }
                }
            })
        )).pipe(
            mergeMap((loadedEvent) => {
                const eventDetail = loadedEvent.eventDetail;
                const eventDetailUUID = eventDetail.uuid;

                return this.eventRedisRepository.getNotificationInfo(eventDetailUUID)
                    .pipe(
                        map((notificationInfo) => {
                            loadedEvent.eventDetail.notificationInfo = notificationInfo;
                            return loadedEvent;
                        })
                    );
            })
        );
    }

    findOneByTeamWorkspaceAndLink(teamWorkspace: string, eventLink: string): Observable<Event> {

        return defer(() => from(this.eventRepository.findOneOrFail({
            relations: {
                eventDetail: true,
                eventProfiles: {
                    profile: {
                        team: {
                            teamSetting: true
                        },
                        availabilities: true
                    }
                }
            },
            where: {
                status: EventStatus.OPENED,
                link: eventLink,
                eventProfiles: {
                    profile: {
                        team: {
                            teamSetting: {
                                workspace: teamWorkspace
                            }
                        },
                        availabilities: {
                            default: true
                        }
                    }
                }
            }
        }))).pipe(
            mergeMap((loadedEvent) => {
                const eventDetail = loadedEvent.eventDetail;
                const eventDetailUUID = eventDetail.uuid;

                return forkJoin({
                    hostQuestions:
                        this.eventRedisRepository.getHostQuestions(eventDetailUUID),
                    notificationInfo: this.eventRedisRepository.getNotificationInfo(eventDetailUUID),
                    eventSetting: this.eventRedisRepository.getEventSetting(eventDetailUUID)
                }).pipe(
                    map(({ hostQuestions, notificationInfo, eventSetting }) => {
                        loadedEvent.eventDetail.hostQuestions = hostQuestions;
                        loadedEvent.eventDetail.notificationInfo = notificationInfo;
                        loadedEvent.eventDetail.eventSetting = eventSetting;
                        return loadedEvent;
                    })
                );
            })
        );
    }

    async create(
        teamUUID: string,
        teamId: number,
        profileId: number,
        newEvent: Event
    ): Promise<Event> {

        this.logger.info({
            message: 'Set up to create a new event. Validate default availability..',
            teamId,
            profileId
        });

        const defaultEventGroup = await this.eventGroupRepository.findOneOrFail({
            relations: {
                team: {
                    profiles: {
                        availabilities: true,
                        user: true
                    }
                }
            },
            where: {
                teamId,
                team: {
                    profiles: {
                        id: profileId,
                        availabilities: {
                            default: true
                        }
                    }
                }
            }
        });

        const profile = defaultEventGroup.team.profiles[0];
        const defaultAvailability = profile.availabilities[0];
        const user = profile.user;
        const noDefaultAvailability = !defaultAvailability;

        if (noDefaultAvailability) {
            throw new NoDefaultAvailabilityException();
        }

        this.logger.info({
            message: 'Default availability is checked. Trying to validate the patched event link is valid..',
            teamId,
            teamUUID,
            profileId,
            newEventLink: newEvent.link
        });

        const defaultAvailabilityId = defaultAvailability.id;

        newEvent.eventGroupId = defaultEventGroup.id;

        const newEventLink = 'new-event-type';

        const isAlreadyUsedIn = await this.eventRedisRepository.getEventLinkSetStatus(teamUUID, newEventLink);

        this.logger.info({
            message: 'Log requested event link status',
            newEventLink,
            isAlreadyUsedIn
        });

        if (isAlreadyUsedIn) {
            const generatedEventSuffix = this.utilService.generateUniqueNumber();
            newEvent.link = [newEventLink, generatedEventSuffix].join('-');
        } else {
            newEvent.link = newEventLink;
        }

        this.logger.info({
            message: 'Event Creating set up is done. Start creating new event with transaction',
            patchedNewEventLink: newEvent.link
        });

        return this._create(
            this.eventRepository.manager,
            teamUUID,
            profileId,
            defaultAvailabilityId,
            newEvent,
            user
        );
    }

    async _create(
        manager: EntityManager,
        teamUUID: string,
        profileId: number,
        defaultAvailabilityId: number,
        newEvent: Event,
        user: User
    ): Promise<Event> {

        const _eventRepository = manager.getRepository(Event);

        const isEmailUser = !!user.email;

        const ensuredNewEvent = this.utilService.getDefaultEvent(newEvent, {
            hasNoEmailUser: !isEmailUser
        });

        const initialEventProfile = {
            profileId,
            availabilityId: defaultAvailabilityId
        } as EventProfile;

        this.logger.info({
            message: 'Initialize eventProfiles with default availability id',
            defaultAvailabilityId,
            initialEventProfile
        });

        ensuredNewEvent.eventProfiles = [initialEventProfile] as EventProfile[];

        // save relation data
        // event detail is saved by orm cascading.
        const savedEvent = await _eventRepository.save(ensuredNewEvent);

        const savedEventDetail = savedEvent.eventDetail;

        // save consumption data
        const newEventDetail = ensuredNewEvent.eventDetail;
        const { hostQuestions, notificationInfo, eventSetting } = newEventDetail;

        this.logger.info({
            message: 'Creating event with event detail, eventProfiles is completed. Set event link status then saving notification info, invitee questions',
            teamUUID,
            savedEventLink: savedEvent.link
        });

        await this.eventRedisRepository.setEventLinkSetStatus(teamUUID, savedEvent.link);

        const savedEventDetailBody = await this.eventRedisRepository.save(
            savedEventDetail.uuid,
            hostQuestions,
            notificationInfo,
            eventSetting
        );

        savedEvent.eventDetail.hostQuestions = savedEventDetailBody.hostQuestions;
        savedEvent.eventDetail.notificationInfo = savedEventDetailBody.notificationInfo;

        this.logger.info({
            message: 'Creating event transaction is going to be committed',
            savedEventId: savedEvent.id
        });

        return savedEvent;
    }

    async patch(
        teamUUID: string,
        teamId: number,
        eventId: number,
        patchEvent: Partial<Event>
    ): Promise<boolean> {
        const validatedEvent = await this.validator.validate(teamId, eventId, Event);

        if (patchEvent.link && patchEvent.link !== validatedEvent.link) {
            const isAlreadyUsedIn = await this.eventRedisRepository.getEventLinkSetStatus(
                teamUUID,
                patchEvent.link
            );

            if (isAlreadyUsedIn) {
                throw new AlreadyUsedInEventLinkException();
            } else {
                await this.eventRedisRepository.deleteEventLinkSetStatus(teamUUID, validatedEvent.link);
                await this.eventRedisRepository.setEventLinkSetStatus(teamUUID, patchEvent.link);
            }
        }

        const updateResult = await this.eventRepository.update(eventId, patchEvent);

        const updateSuccess = updateResult && updateResult.affected && updateResult.affected > 0;

        return updateSuccess === true;
    }

    /**
     * The properties of passed event object are filtered by the class-transformer,
     * according to the DTO decorators.
     * However the event details are not yet trusted,
     * so they are verified by TypeORM findOneByOrFail with
     * condition for its id and uuid.
     */
    async update(
        teamUUID: string,
        teamId: number,
        eventId: number,
        updatedEvent: Omit<Event, 'id'>
    ): Promise<boolean> {
        const validatedEvent = await this.validator.validate(teamId, eventId, Event);
        const validatedEventDetail = validatedEvent.eventDetail;

        const updatedEventDetail = updatedEvent.eventDetail;

        // update event link
        // check duplication
        const isLinkAlreadyUsedIn = await this.eventRedisRepository.getEventLinkSetStatus(teamUUID, updatedEvent.link);

        const isLinkUpdateRequest = validatedEvent.link !== updatedEvent.link;

        if (isLinkAlreadyUsedIn && isLinkUpdateRequest) {
            throw new AlreadyUsedInEventLinkException();
        }

        await this.datasource.transaction(async (transactionManager) => {
            const _eventRepository = transactionManager.getRepository(Event);
            const _eventDetailRepository = transactionManager.getRepository(EventDetail);

            const {
                eventDetail: _eventDetail,
                eventProfiles: _eventProfiles,
                ..._updateEvent
            } = plainToInstance(Event, updatedEvent, {
                strategy: 'exposeAll'
            });

            /* eslint-disable @typescript-eslint/no-unused-vars */
            const {
                notificationInfo: _notificationInfo,
                eventSetting: _eventSetting,
                hostQuestions: _hostQuestions,
                ..._updateEventDetail
            } = plainToInstance(EventDetail, _eventDetail, {
                strategy: 'exposeAll'
            });

            const _patchedEventProfiles = plainToInstance(EventProfile, _eventProfiles, {
                strategy: 'exposeAll'
            });
            /* eslint-enable @typescript-eslint/no-unused-vars */

            const _eventUpdateResult = await _eventRepository.update(eventId, _updateEvent);
            const _isEventUpdateSuccess = _eventUpdateResult.affected && _eventUpdateResult.affected > 0;

            await this._linkToProfiles(
                transactionManager,
                _patchedEventProfiles
            );

            const _eventDetailUpdateResult = await _eventDetailRepository.update(validatedEventDetail.id, _updateEventDetail);
            const _isEventDetailUpdateSuccess = _eventDetailUpdateResult.affected && _eventDetailUpdateResult.affected > 0;

            const _rdbUpdateSuccess = _isEventUpdateSuccess && _isEventDetailUpdateSuccess;
            if (_rdbUpdateSuccess === false) {
                throw new InternalServerErrorException('Evnet update is faield');
            }

            return _rdbUpdateSuccess;
        });

        // update event detail
        await this.eventRedisRepository.save(
            validatedEventDetail.uuid,
            updatedEventDetail.hostQuestions,
            updatedEventDetail.notificationInfo,
            updatedEventDetail.eventSetting
        );
        await this.eventRedisRepository.deleteEventLinkSetStatus(teamUUID, validatedEvent.link);
        await this.eventRedisRepository.setEventLinkSetStatus(teamUUID, updatedEvent.link);

        return true;
    }

    async remove(eventId: number, teamId: number): Promise<boolean> {
        const validatedEvent = await this.validator.validate(teamId, eventId, Event);

        const eventDetail = validatedEvent.eventDetail;

        const deleteSuccess = await this.datasource.transaction(async (transactionManager) => {
            const _eventRepository = transactionManager.getRepository(Event);
            const _eventDetailRepository = transactionManager.getRepository(EventDetail);

            const _deleteEventDetailResult = await _eventDetailRepository.delete(eventDetail.id);
            const _deleteEventResult = await _eventRepository.delete(eventId);

            const _isDeleteEventDetailSuccess =
                (_deleteEventDetailResult.affected && _deleteEventDetailResult.affected > 0) ===
                true;
            const _isDeleteEventSuccess =
                (_deleteEventResult.affected && _deleteEventResult.affected > 0) === true;

            if (_isDeleteEventDetailSuccess === false || _isDeleteEventSuccess === false) {
                throw new InternalServerErrorException('Delete event detail or event is failed');
            }

            await this.eventRedisRepository.remove(eventDetail.uuid);

            return _isDeleteEventDetailSuccess && _isDeleteEventSuccess;
        });

        return deleteSuccess;
    }

    async clone(eventId: number, teamId: number, teamUUID: string): Promise<Event> {
        const validatedEvent = await this.validator.validate(teamId, eventId, Event);

        /* eslint-disable @typescript-eslint/no-unused-vars */
        const {
            id: _eventId,
            uuid: _eventUUID,
            createdAt: _eventCreatedAt,
            ...newEventBody
        } = validatedEvent;

        const {
            id,
            eventId: _eventIdInEventDetail,
            uuid: eventDetailUUID,
            ...newEventDetailBody
        } = newEventBody.eventDetail;
        /* eslint-enable @typescript-eslint/no-unused-vars */

        const generatedEventSuffix = this.utilService.generateUniqueNumber();
        newEventBody.eventDetail = newEventDetailBody as EventDetail;
        newEventBody.link = `${validatedEvent.link}-${generatedEventSuffix}`;

        const clonedEvent = await this.eventRepository.save(newEventBody);

        const clonedEventDetailBody = await firstValueFrom(
            this.eventRedisRepository.clone(eventDetailUUID, clonedEvent.eventDetail.uuid)
        );

        await this.eventRedisRepository.setEventLinkSetStatus(teamUUID, clonedEvent.link);

        clonedEvent.eventDetail.hostQuestions = clonedEventDetailBody.hostQuestions;
        clonedEvent.eventDetail.notificationInfo = clonedEventDetailBody.notificationInfo;
        clonedEvent.eventDetail.eventSetting = clonedEventDetailBody.eventSetting;

        return clonedEvent;
    }

    async linkToProfiles(
        teamId: number,
        eventProfiles: EventProfile[]
    ): Promise<boolean> {

        const eventIds = eventProfiles.map((_eventProfile) => _eventProfile.eventId);
        for (const _eventId of eventIds) {
            await this.validator.validate(teamId, _eventId, Event);
        }

        return await this.datasource.transaction(async (transactionManager) =>
            this._linkToProfiles(
                transactionManager,
                eventProfiles
            )
        );
    }

    async _linkToProfiles(
        transactionManager: EntityManager,
        eventProfiles: EventProfile[]
    ): Promise<boolean> {

        const _eventProfileRepository = transactionManager.getRepository(EventProfile);

        await Promise.all(
            eventProfiles.map((_eventProfile) => {
                _eventProfileRepository.update(
                    {
                        eventId: _eventProfile.eventId,
                        profileId: _eventProfile.profileId
                    },
                    _eventProfile
                );
            })
        );

        return true;
    }

    async linkToAvailability(
        teamId: number,
        eventId: number,
        profileId: number,
        availabilityId: number
    ): Promise<boolean> {
        await this.validator.validate(teamId, eventId, Event);

        await this.eventProfileRepository.update({
            eventId,
            profileId
        }, {
            availabilityId
        });

        return true;
    }

    async linksToAvailability(
        teamId: number,
        profileId: number,
        eventIds: number[],
        availabilityId: number,
        defaultAvailabilityId: number
    ): Promise<boolean> {
        const isDefaultAvailabilityLink = availabilityId === defaultAvailabilityId;

        const linkedEventsWithAvailability = await firstValueFrom(
            this.search({
                teamId,
                availabilityId
            })
        );

        const exclusiveEventIds = linkedEventsWithAvailability
            .filter((_event) => eventIds.includes(_event.id) === false)
            .map((_event) => _event.id);

        const linkResult = await this.datasource.transaction(async (transactionManager) => {
            const _eventProfileRepository = transactionManager.getRepository(EventProfile);

            let isExclusiveEventsUpdateSuccess = false;

            const shouldUnlinkRestEvents =
                exclusiveEventIds.length > 0 && isDefaultAvailabilityLink === false;

            if (shouldUnlinkRestEvents) {
                const exclusiveEventsUpdateResult = await _eventProfileRepository.update(
                    exclusiveEventIds,
                    {
                        availabilityId: defaultAvailabilityId
                    }
                );

                isExclusiveEventsUpdateSuccess =
                    !!exclusiveEventsUpdateResult.affected &&
                    exclusiveEventsUpdateResult.affected > 0;
            } else {
                isExclusiveEventsUpdateSuccess = true;
            }

            const eventsUpdateResult = await _eventProfileRepository.update({
                eventId: In(eventIds),
                profileId
            }, {
                availabilityId
            });

            const isEventsUpdateSuccess: boolean =
                !!eventsUpdateResult.affected && eventsUpdateResult.affected > 0;

            return isExclusiveEventsUpdateSuccess && isEventsUpdateSuccess;
        });

        return linkResult;
    }

    async unlinksToAvailability(
        availabilityId: number,
        defaultAvailabilityId: number
    ): Promise<boolean> {
        return this._unlinksToAvailability(
            this.eventRepository.manager,
            availabilityId,
            defaultAvailabilityId
        );
    }

    async _unlinksToAvailability(
        manager: EntityManager,
        availabilityId: number,
        defaultAvailabilityId: number
    ): Promise<boolean> {

        const eventProfileRepository = manager.getRepository(EventProfile);

        const updateResult = await eventProfileRepository.update(
            {
                availabilityId
            },
            {
                availabilityId: defaultAvailabilityId
            }
        );

        return updateResult.affected ? updateResult.affected > 0 : false;
    }

    async hasOwnEvents(teamId: number, eventIds: number[]): Promise<boolean> {
        const loadedEvents = await this.eventRepository.find({
            select: {
                id: true
            },
            relations: ['eventGroup'],
            where: {
                id: In(eventIds),
                eventGroup: {
                    teamId
                }
            },
            order: {
                id: 'ASC'
            }
        });

        const requestEventIdList = eventIds.sort((eventIdA, eventIdB) => eventIdA - eventIdB);

        const isSameContent =
            JSON.stringify(requestEventIdList) ===
            JSON.stringify(loadedEvents.map((_event) => _event.id));

        const isSamaLength = loadedEvents.length === eventIds.length;

        let areAllOwnEvents = false;

        if (isSamaLength && isSameContent) {
            areAllOwnEvents = true;
        }

        return areAllOwnEvents;
    }

    async hasOwnEventsOrThrow(teamId: number, eventIds: number[]): Promise<void> {
        const hasAllOwnedEvents = await this.hasOwnEvents(teamId, eventIds);

        if (hasAllOwnedEvents === false) {
            throw new NotAnOwnerException('Some event id in requested list is not owned');
        }
    }
}
