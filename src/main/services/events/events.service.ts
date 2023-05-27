import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Observable, firstValueFrom, forkJoin, from, map, mergeMap, of } from 'rxjs';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Event } from '@core/entities/events/event.entity';
import { EventGroup } from '@core/entities/events/evnet-group.entity';
import { EventDetail } from '@core/entities/events/event-detail.entity';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { Availability } from '@entity/availability/availability.entity';
import { EventsSearchOption } from '@app/interfaces/events/events-search-option.interface';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { Validator } from '@criteria/validator';

@Injectable()
export class EventsService {
    constructor(
        private readonly validator: Validator,
        private readonly eventRedisRepository: EventsRedisRepository,
        @InjectDataSource() private datasource: DataSource,
        @InjectRepository(EventGroup) private readonly eventGroupRepository: Repository<EventGroup>,
        @InjectRepository(Event) private readonly eventRepository: Repository<Event>
    ) {}

    search(searchOption: EventsSearchOption): Observable<Event[]> {
        return from(
            this.eventRepository.find({
                relations: ['eventGroup'],
                where: {
                    eventGroup: {
                        userId: searchOption.userId
                    },
                    availabilityId: searchOption.availabilityId
                },
                order: {
                    priority: 'DESC'
                }
            })
        );
    }

    findOne(eventId: number): Observable<Event> {
        return from(
            this.eventRepository.findOneOrFail({
                relations: ['eventDetail'],
                where: {
                    id: eventId
                }
            })
        ).pipe(
            mergeMap((loadedEvent) => {
                const eventDetail = loadedEvent.eventDetail;
                const eventDetailUUID = eventDetail.uuid;

                return forkJoin({
                    inviteeQuestions:
                        this.eventRedisRepository.getInviteeQuestions(eventDetailUUID),
                    reminders: this.eventRedisRepository.getReminders(eventDetailUUID),
                    event: of(loadedEvent)
                }).pipe(
                    map(({ inviteeQuestions, reminders, event }) => {
                        event.eventDetail.inviteeQuestions = inviteeQuestions;
                        event.eventDetail.reminders = reminders;
                        return event;
                    })
                );
            })
        );
    }

    async create(userId: number, newEvent: Event): Promise<Event> {
        const defaultEventGroup = await this.eventGroupRepository.findOneByOrFail({ userId });

        newEvent.eventGroupId = defaultEventGroup.id;

        // save relation data
        // event detail is saved by orm cascading.
        const savedEvent = await this.eventRepository.save(newEvent);

        const savedEventDetail = savedEvent.eventDetail;

        // save consumption data
        const newEventDetail = newEvent.eventDetail;
        const { inviteeQuestions, reminders } = newEventDetail;
        const savedEventDetailBody = await this.eventRedisRepository.save(
            savedEventDetail.uuid,
            inviteeQuestions,
            reminders
        );

        savedEvent.eventDetail.inviteeQuestions = savedEventDetailBody.inviteeQuestions;
        savedEvent.eventDetail.reminders = savedEventDetailBody.reminders;

        return savedEvent;
    }

    async update(eventId: number, userId: number, updateEvent: Partial<Event>): Promise<boolean> {
        await this.validator.validate(userId, eventId, Event);

        const updateResult = await this.eventRepository.update(eventId, updateEvent);

        const updateSuccess = updateResult && updateResult.affected && updateResult.affected > 0;

        return updateSuccess === true;
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

    async clone(eventId: number, userId: number): Promise<Event> {
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

        newEventBody.eventDetail = newEventDetailBody as EventDetail;

        const clonedEvent = await this.eventRepository.save(newEventBody);

        const clonedEventDetailBody = await firstValueFrom(
            this.eventRedisRepository.clone(eventDetailUUID, clonedEvent.eventDetail.uuid)
        );

        clonedEvent.eventDetail.inviteeQuestions = clonedEventDetailBody.inviteeQuestions;
        clonedEvent.eventDetail.reminders = clonedEventDetailBody.reminders;

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
        const updateResult = await this.eventRepository.update(
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
