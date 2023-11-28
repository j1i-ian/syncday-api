import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Observable, firstValueFrom, forkJoin, from, map, mergeMap } from 'rxjs';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Event } from '@core/entities/events/event.entity';
import { EventGroup } from '@core/entities/events/evnet-group.entity';
import { EventDetail } from '@core/entities/events/event-detail.entity';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { UtilService } from '@services/util/util.service';
import { Availability } from '@entity/availability/availability.entity';
import { EventStatus } from '@entity/events/event-status.enum';
import { EventsSearchOption } from '@app/interfaces/events/events-search-option.interface';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { NoDefaultAvailabilityException } from '@app/exceptions/availability/no-default-availability.exception';
import { AlreadyUsedInEventLinkException } from '@app/exceptions/events/already-used-in-event-link.exception';
import { Validator } from '@criteria/validator';

@Injectable()
export class EventsService {
    constructor(
        private readonly validator: Validator,
        private readonly eventRedisRepository: EventsRedisRepository,
        private readonly utilService: UtilService,
        @InjectDataSource() private datasource: DataSource,
        @InjectRepository(EventGroup) private readonly eventGroupRepository: Repository<EventGroup>,
        @InjectRepository(Event) private readonly eventRepository: Repository<Event>
    ) {}

    search(searchOption: EventsSearchOption): Observable<Event[]> {
        return from(
            this.eventRepository.find({
                relations: ['eventGroup', 'eventDetail'],
                where: {
                    status: searchOption.status,
                    public: searchOption.public,
                    eventGroup: {
                        userId: searchOption.userId
                    },
                    availability: {
                        id: searchOption.availabilityId,
                        user: {
                            userSetting: {
                                workspace: searchOption.userWorkspace
                            }
                        }
                    }
                },
                order: {
                    priority: 'DESC'
                }
            })
        ).pipe(
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

    findOne(eventId: number, userId: number): Observable<Event> {
        return from(
            this.validator.validate(userId, eventId, Event)
        ).pipe(
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
                    inviteeQuestions:
                        this.eventRedisRepository.getInviteeQuestions(eventDetailUUID),
                    notificationInfo: this.eventRedisRepository.getNotificationInfo(eventDetailUUID),
                    eventSetting: this.eventRedisRepository.getEventSetting(eventDetailUUID)
                }).pipe(
                    map(({ inviteeQuestions, notificationInfo, eventSetting }) => {
                        loadedEvent.eventDetail.inviteeQuestions = inviteeQuestions;
                        loadedEvent.eventDetail.notificationInfo = notificationInfo;
                        loadedEvent.eventDetail.eventSetting = eventSetting;
                        return loadedEvent;
                    })
                );
            })
        );
    }

    findOneByUserWorkspaceAndUUID(userWorkspace: string, eventUUID: string): Observable<Event> {
        return from(
            this.eventRepository.findOneOrFail({
                relations: ['eventDetail', 'availability'],
                where: {
                    uuid: eventUUID,
                    status: EventStatus.OPENED,
                    availability: {
                        user: {
                            userSetting: {
                                workspace: userWorkspace
                            }
                        }
                    }
                }
            })
        ).pipe(
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

    findOneByUserWorkspaceAndLink(userWorkspace: string, eventLink: string): Observable<Event> {

        return from(this.eventRepository.findOneOrFail({
            relations: ['eventDetail'],
            where: {
                status: EventStatus.OPENED,
                link: eventLink,
                availability: {
                    user: {
                        userSetting: {
                            workspace: userWorkspace
                        }
                    }
                }
            }
        })).pipe(
            mergeMap((loadedEvent) => {
                const eventDetail = loadedEvent.eventDetail;
                const eventDetailUUID = eventDetail.uuid;

                return forkJoin({
                    inviteeQuestions:
                        this.eventRedisRepository.getInviteeQuestions(eventDetailUUID),
                    notificationInfo: this.eventRedisRepository.getNotificationInfo(eventDetailUUID),
                    eventSetting: this.eventRedisRepository.getEventSetting(eventDetailUUID)
                }).pipe(
                    map(({ inviteeQuestions, notificationInfo, eventSetting }) => {
                        loadedEvent.eventDetail.inviteeQuestions = inviteeQuestions;
                        loadedEvent.eventDetail.notificationInfo = notificationInfo;
                        loadedEvent.eventDetail.eventSetting = eventSetting;
                        return loadedEvent;
                    })
                );
            })
        );
    }

    async create(userUUID: string, userId: number, newEvent: Event): Promise<Event> {
        const defaultEventGroup = await this.eventGroupRepository.findOneOrFail({
            relations: ['user', 'user.availabilities'],
            where: {
                userId,
                user: {
                    availabilities: {
                        default: true
                    }
                }
            }
        });

        const defaultAvailability = defaultEventGroup.user.availabilities.pop();

        if (defaultAvailability) {
            newEvent.availabilityId = defaultAvailability.id;
        } else {
            throw new NoDefaultAvailabilityException();
        }

        newEvent.eventGroupId = defaultEventGroup.id;

        const isAlreadyUsedIn = await this.eventRedisRepository.getEventLinkSetStatus(userUUID, newEvent.name);

        const newEventLink = newEvent.name.replace(/\s/g, '-');

        if (isAlreadyUsedIn) {
            const generatedEventSuffix = this.utilService.generateUniqueNumber();
            newEvent.link = `${newEventLink}-${generatedEventSuffix}`;
        } else {
            newEvent.link = newEventLink;
        }

        const ensuredNewEvent = this.utilService.getDefaultEvent(newEvent);

        // save relation data
        // event detail is saved by orm cascading.
        const savedEvent = await this.eventRepository.save(ensuredNewEvent);

        const savedEventDetail = savedEvent.eventDetail;

        // save consumption data
        const newEventDetail = ensuredNewEvent.eventDetail;
        const { inviteeQuestions, notificationInfo, eventSetting } = newEventDetail;
        const savedEventDetailBody = await this.eventRedisRepository.save(savedEventDetail.uuid, inviteeQuestions, notificationInfo, eventSetting);

        savedEvent.eventDetail.inviteeQuestions = savedEventDetailBody.inviteeQuestions;
        savedEvent.eventDetail.notificationInfo = savedEventDetailBody.notificationInfo;

        await this.eventRedisRepository.setEventLinkSetStatus(userUUID, savedEvent.link);

        return savedEvent;
    }

    async patch(
        userUUID: string,
        userId: number,
        eventId: number,
        patchEvent: Partial<Event>
    ): Promise<boolean> {
        await this.validator.validate(userId, eventId, Event);

        if (patchEvent.link) {
            const isAlreadyUsedIn = await this.eventRedisRepository.getEventLinkSetStatus(
                userUUID,
                patchEvent.link
            );

            if (isAlreadyUsedIn) {
                throw new AlreadyUsedInEventLinkException();
            } else {
                await this.eventRedisRepository.setEventLinkSetStatus(userUUID, patchEvent.link);
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
        userUUID: string,
        userId: number,
        eventId: number,
        updatedEvent: Omit<Event, 'id'>
    ): Promise<boolean> {
        const validatedEvent = await this.validator.validate(userId, eventId, Event);

        const updatedEventDetail = updatedEvent.eventDetail;

        // update event link
        // check duplication
        const isLinkAlreadyUsedIn = await this.eventRedisRepository.getEventLinkSetStatus(userUUID, updatedEvent.link);

        const isLinkUpdateRequest = validatedEvent.link !== updatedEvent.link;

        if (isLinkAlreadyUsedIn && isLinkUpdateRequest) {
            throw new AlreadyUsedInEventLinkException();
        }

        await this.datasource.transaction(async (transactionManager) => {
            const _eventRepository = transactionManager.getRepository(Event);
            const _eventDetailRepository = transactionManager.getRepository(EventDetail);

            const loadedEventDetail = await _eventDetailRepository.findOneByOrFail({
                eventId,
                id: updatedEventDetail.id,
                uuid: updatedEventDetail.uuid
            });
            const _updateEvent = plainToInstance(Event, updatedEvent, {
                excludeExtraneousValues: true,
                strategy: 'exposeAll'
            });
            const _updateEventDetail = plainToInstance(EventDetail, updatedEventDetail, {
                excludeExtraneousValues: true,
                strategy: 'exposeAll'
            });

            const _eventUpdateResult = await _eventRepository.update(eventId, _updateEvent);
            const _isEventUpdateSuccess = _eventUpdateResult.affected && _eventUpdateResult.affected > 0;
            const _eventDetailUpdateResult = await _eventDetailRepository.update(loadedEventDetail.id, _updateEventDetail);
            const _isEventDetailUpdateSuccess = _eventDetailUpdateResult.affected && _eventDetailUpdateResult.affected > 0;

            const _rdbUpdateSuccess = _isEventUpdateSuccess && _isEventDetailUpdateSuccess;
            if (_rdbUpdateSuccess === false) {
                throw new InternalServerErrorException('Evnet update is faield');
            }

            return _rdbUpdateSuccess;
        });

        // update event detail
        await this.eventRedisRepository.save(
            updatedEventDetail.uuid,
            updatedEventDetail.inviteeQuestions,
            updatedEventDetail.notificationInfo,
            updatedEventDetail.eventSetting
        );
        await this.eventRedisRepository.setEventLinkSetStatus(userUUID, updatedEvent.link);

        return true;
    }

    async remove(eventId: number, userId: number): Promise<boolean> {
        const validatedEvent = await this.validator.validate(userId, eventId, Event);

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

    async clone(eventId: number, userId: number, uesrUUID: string): Promise<Event> {
        const validatedEvent = await this.validator.validate(userId, eventId, Event);

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

        await this.eventRedisRepository.setEventLinkSetStatus(uesrUUID, clonedEvent.link);

        clonedEvent.eventDetail.inviteeQuestions = clonedEventDetailBody.inviteeQuestions;
        clonedEvent.eventDetail.notificationInfo = clonedEventDetailBody.notificationInfo;
        clonedEvent.eventDetail.eventSetting = clonedEventDetailBody.eventSetting;

        return clonedEvent;
    }

    async linkToAvailability(
        userId: number,
        eventId: number,
        availabilityId: number
    ): Promise<boolean> {
        await this.validator.validate(userId, eventId, Event);
        await this.validator.validate(userId, availabilityId, Availability);

        await this.eventRepository.update(eventId, {
            availabilityId
        });

        return true;
    }

    async linksToAvailability(
        userId: number,
        eventIds: number[],
        availabilityId: number,
        defaultAvailabilityId: number
    ): Promise<boolean> {
        const isDefaultAvailabilityLink = availabilityId === defaultAvailabilityId;

        const linkedEventsWithAvailability = await firstValueFrom(
            this.search({
                userId,
                availabilityId
            })
        );

        const exclusiveEventIds = linkedEventsWithAvailability
            .filter((_event) => eventIds.includes(_event.id) === false)
            .map((_event) => _event.id);

        const linkResult = await this.datasource.transaction(async (transactionManager) => {
            const _eventRepository = transactionManager.getRepository(Event);

            let isExclusiveEventsUpdateSuccess = false;

            const shouldUnlinkRestEvents =
                exclusiveEventIds.length > 0 && isDefaultAvailabilityLink === false;

            if (shouldUnlinkRestEvents) {
                const exclusiveEventsUpdateResult = await _eventRepository.update(
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

            const eventsUpdateResult = await _eventRepository.update(eventIds, {
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

        const eventRepository = manager.getRepository(Event);

        const updateResult = await eventRepository.update(
            {
                availabilityId
            },
            {
                availabilityId: defaultAvailabilityId
            }
        );

        return updateResult.affected ? updateResult.affected > 0 : false;
    }

    async hasOwnEvents(userId: number, eventIds: number[]): Promise<boolean> {
        const loadedEvents = await this.eventRepository.find({
            select: {
                id: true
            },
            relations: ['eventGroup'],
            where: {
                id: In(eventIds),
                eventGroup: {
                    userId
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

    async hasOwnEventsOrThrow(userId: number, eventIds: number[]): Promise<void> {
        const hasAllOwnedEvents = await this.hasOwnEvents(userId, eventIds);

        if (hasAllOwnedEvents === false) {
            throw new NotAnOwnerException('Some event id in requested list is not owned');
        }
    }
}
