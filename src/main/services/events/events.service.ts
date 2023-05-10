import { Injectable } from '@nestjs/common';
import { Observable, forkJoin, from, map, mergeMap, of } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from '@core/entities/events/event.entity';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { UpdateEventRequestDto } from '@dto/event-groups/events/update-event-request.dto';
import { SearchByUserOption } from '@app/interfaces/search-by-user-option.interface';

@Injectable()
export class EventsService {
    constructor(
        private readonly eventRedisRepository: EventsRedisRepository,
        @InjectRepository(Event) private readonly eventRepository: Repository<Event>
    ) {}

    search(searchOption: SearchByUserOption): Observable<Event[]> {
        return from(
            this.eventRepository.find({
                relations: ['eventGroup'],
                where: {
                    eventGroup: {
                        userId: searchOption.userId
                    }
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

    update(eventId: number, updateEventDto: UpdateEventRequestDto): Promise<boolean> {
        console.log(eventId);
        console.log(updateEventDto);
        return Promise.resolve(true);
    }

    async remove(eventId: number): Promise<boolean> {
        console.log(eventId);
        return Promise.resolve(true);
    }
}
