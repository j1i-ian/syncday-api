/* eslint-disable @typescript-eslint/no-unused-vars */
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, UpdateResult, DataSource, EntityManager } from 'typeorm';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Event } from '@entity/events/event.entity';
import { User } from '@entity/users/user.entity';
import { UpdateEventRequestDto } from '@dto/event-groups/events/update-event-request.dto';
import { CreateEventRequestDto } from '@dto/event-groups/events/create-event-request.dto';
import { EventDetail } from '../../../../@core/core/entities/events/event-detail.entity';
import { EventGroup } from '../../../../@core/core/entities/events/evnet-group.entity';
import { SyncdayRedisService } from '../../syncday-redis/syncday-redis.service';
import { InviteeQuestion } from '../../../../@core/core/entities/invitee-questions/invitee-question.entity';
import { Reminder } from '../../../../@core/core/entities/reminders/reminder.entity';

@Injectable()
export class EventsService {
    constructor(
        @InjectRepository(Event)
        private readonly eventRepository: Repository<Event>,
        private readonly dataSource: DataSource,
        private readonly syncdayRedisService: SyncdayRedisService
    ) {}

    findAll(): Event[] {
        return [] as Event[];
    }

    findOne(id: number): Event {
        return {} as Event;
    }

    async create(userId: number, createEventDto: CreateEventRequestDto): Promise<Event> {
        if (createEventDto.eventDetail.contacts.length > 1) {
            throw new BadRequestException('More than one contact is not allowed');
        }

        const addedEvent = await this.dataSource.transaction(async (manager: EntityManager) => {
            const initialEventGroup = new EventGroup({ userId });
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

    update(id: number, updateEventDto: UpdateEventRequestDto): boolean {
        return true;
    }

    remove(id: number): boolean {
        return true;
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
}
