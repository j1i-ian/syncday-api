/* eslint-disable @typescript-eslint/no-unused-vars */
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, UpdateResult } from 'typeorm';
import { BadRequestException, Injectable } from '@nestjs/common';
import { RedisKey } from 'ioredis';
import { Event } from '@entity/events/event.entity';
import { User } from '@entity/users/user.entity';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { UpdateEventRequestDto } from '@dto/event-groups/events/update-event-request.dto';
import { CreateEventRequestDto } from '@dto/event-groups/events/create-event-request.dto';
import { EventDetail } from '../../../../@core/core/entities/events/event-detail.entity';
import { SyncdayRedisService } from '../../syncday-redis/syncday-redis.service';
import { InviteeQuestion } from '../../../../@core/core/entities/invitee-questions/invitee-question.entity';
import { Reminder } from '../../../../@core/core/entities/reminders/reminder.entity';
import { UtilService } from '../../util/util.service';
import { GetEventsSearchOptions } from '../../../parameters/event-groups/events/get-events.param';
import { EventGroupsService } from '../event-groups.service';

@Injectable()
export class EventsService {
    constructor(
        private readonly eventGroupsService: EventGroupsService,
        private readonly utilService: UtilService,
        private readonly dataSource: DataSource,
        private readonly syncdayRedisService: SyncdayRedisService,
        @InjectRepository(Event)
        private readonly eventRepository: Repository<Event>
    ) {}

    async findAll(userId: number, searchOptions: GetEventsSearchOptions): Promise<Event[]> {
        const sql = this.eventRepository
            .createQueryBuilder()
            .leftJoin(EventGroup, 'eventGroup')
            .where('eventGroup.userId = :userId', { userId });
        const sqlWithWhereCondition = this._getEventsApplyWhereClause(sql, searchOptions);

        const events = await sqlWithWhereCondition.getMany();

        return events;
    }

    findOne(id: number): Event {
        return {} as Event;
    }

    async create(userId: number, createEventDto: CreateEventRequestDto): Promise<Event> {
        if (createEventDto.eventDetail.contacts.length > 1) {
            throw new BadRequestException('More than one contact is not allowed');
        }

        const addedEvent = await this.dataSource.transaction(async (manager: EntityManager) => {
            const initialEventGroup = await this.eventGroupsService.createDefaultEventGroup(
                userId,
                manager
            );
            const { eventDetail: eventDetailInfoWithRedisData, ...newEventInfo } = createEventDto;
            const newEvent = new Event(newEventInfo);

            const {
                inviteeQuestions: inviteeQuestionsInfo,
                reminders: remindersInfo,
                ...eventDetailInfo
            } = eventDetailInfoWithRedisData;
            const newEventDetail = new EventDetail(eventDetailInfo);

            newEvent.eventGroup = initialEventGroup;
            newEvent.eventDetail = newEventDetail;

            const _addedEvent = await manager.save(newEvent);

            const newInviteeQuestions = inviteeQuestionsInfo.map(
                (inviteeQuestionInfo) => new InviteeQuestion(inviteeQuestionInfo)
            );
            await this.syncdayRedisService.setInviteeQuestion(
                _addedEvent.uuid,
                newInviteeQuestions
            );
            _addedEvent.eventDetail.inviteeQuestions = newInviteeQuestions;

            const newReminders = remindersInfo.map((reminderInfo) => new Reminder(reminderInfo));
            await this.syncdayRedisService.setReminder(_addedEvent.uuid, newReminders);
            _addedEvent.eventDetail.reminders = newReminders;

            return _addedEvent;
        });

        return addedEvent;
    }

    async update(
        id: number,
        userId: number,
        updateEventDto: UpdateEventRequestDto
    ): Promise<boolean> {
        const event = await this.findEventById(userId, id);
        const { eventDetail: eventDetailDto, ...eventProperties } = updateEventDto;
        const validEventDetailDto = eventDetailDto ?? {};
        const { inviteeQuestions, reminders, ...eventDetailProperties } = validEventDetailDto;
        const redisPayload: Array<{
            key: RedisKey;
            value: string;
        }> = [];

        if (inviteeQuestions) {
            const inviteeQuestionKey = this.syncdayRedisService.getInviteeQuestionKey(event.uuid);

            redisPayload.push({
                key: inviteeQuestionKey,
                value: JSON.stringify(inviteeQuestions)
            });
        }
        if (reminders) {
            const reminderKey = this.syncdayRedisService.getReminderKey(event.uuid);

            redisPayload.push({
                key: reminderKey,
                value: JSON.stringify(reminders)
            });
        }

        const updateResult = await this.dataSource.transaction(async (manager) => {
            const _eventRepository = manager.getRepository(Event);
            const _eventDetailRepository = manager.getRepository(EventDetail);

            await _eventDetailRepository.update(event.eventDetail.id, eventDetailProperties);
            const _updateResult = await _eventRepository.update(event.id, eventProperties);

            await this.syncdayRedisService.multiSet(redisPayload);

            return _updateResult;
        });

        return updateResult.affected && updateResult.affected > 0 ? true : false;
    }

    remove(id: number): boolean {
        return true;
    }

    async copyEvent(userId: number, eventId: number, copyPath: string): Promise<Event> {
        const eventGroupId = this.utilService.getGroupEventIdFromPath(copyPath);
        const targetEventGroup = await this.eventGroupsService.findEventGroupById(
            eventGroupId,
            userId
        );
        const targetEvent = await this.findEventById(userId, eventId);
        const targetRemainder = await this.syncdayRedisService.getReminder(targetEvent.uuid);
        const targetInviteeQuestion = await this.syncdayRedisService.getInviteeQuestion(
            targetEvent.uuid
        );

        const copyResult = await this.dataSource.transaction(async (manager) => {
            const _eventRepository = manager.getRepository(Event);
            const _eventDetailRepository = manager.getRepository(EventDetail);

            const {
                id,
                uuid,
                eventDetail,
                eventGroup,
                eventGroupId,
                createdAt,
                ...evnetWithoutIdentifierAndEventGroupRelation
            } = targetEvent;
            const {
                id: eventDetailId,
                uuid: eventDetailUuid,
                ...eventdDetailWithoutIdentifier
            } = targetEvent.eventDetail;

            const newEvent = _eventRepository.create({
                ...evnetWithoutIdentifierAndEventGroupRelation,
                eventGroupId: targetEventGroup.id
            });
            const newEventDetail = _eventDetailRepository.create(eventdDetailWithoutIdentifier);
            newEvent.eventDetail = newEventDetail;
            const createdEvent = await _eventRepository.save(newEvent);

            const inviteeQuestionKey = this.syncdayRedisService.getInviteeQuestionKey(
                createdEvent.uuid
            );
            const reminderKey = this.syncdayRedisService.getReminderKey(createdEvent.uuid);

            await this.syncdayRedisService.multiSet([
                { key: inviteeQuestionKey, value: JSON.stringify(targetInviteeQuestion) },
                { key: reminderKey, value: JSON.stringify(targetRemainder) }
            ]);

            createdEvent.eventDetail.inviteeQuestions = targetInviteeQuestion;
            createdEvent.eventDetail.reminders = targetRemainder;

            return createdEvent;
        });

        return copyResult;
    }

    async updateDatetimePresetRelation(
        eventIds: number[],
        userId: number,
        datetimePresetId: number
    ): Promise<UpdateResult> {
        const getEventIdsSubQuery = this.eventRepository
            .createQueryBuilder('event')
            .select('event.id')
            .leftJoin(EventGroup, 'eventGroup', 'eventGroup.id = event.eventGroupId')
            .leftJoin(User, 'user')
            .where('eventGroup.userId = :userId', { userId })
            .andWhere('event.id IN (:eventIds)', { eventIds });

        const updateResult = await this.eventRepository
            .createQueryBuilder('event')
            .update('event')
            .set({
                datetimePresetId
            })
            .where(`event.id IN (${getEventIdsSubQuery.getQuery()})`)
            .setParameters(getEventIdsSubQuery.getParameters())
            .execute();

        return updateResult;
    }

    async findEventById(userId: number, eventId: number): Promise<Event> {
        const event = await this.eventRepository.findOneOrFail({
            relations: {
                eventDetail: true,
                eventGroup: true
            },
            where: {
                id: eventId,
                eventGroup: {
                    userId
                }
            }
        });

        return event;
    }

    _getEventsApplyWhereClause(
        sql: SelectQueryBuilder<Event>,
        searchOptions: GetEventsSearchOptions
    ): SelectQueryBuilder<Event> {
        const sqlWithWhereClause = sql;

        if (searchOptions.status !== undefined) {
            sqlWithWhereClause.andWhere('status = :status', {
                status: searchOptions.status
            });
        }

        return sqlWithWhereClause;
    }
}
