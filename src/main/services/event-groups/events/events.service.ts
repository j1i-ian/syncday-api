/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Event } from '@entity/events/event.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { CreateEventDto } from '@dto/event-groups/events/create-event.dto';
import { UpdateEventDto } from '@dto/event-groups/events/update-event.dto';

@Injectable()
export class EventsService {
    constructor(
        @InjectRepository(EventDetail)
        private readonly eventDetailRepository: Repository<EventDetail>
    ) {}

    findAll(): Event[] {
        return [] as Event[];
    }

    findOne(id: number): Event {
        return {} as Event;
    }

    create(createEventDto: CreateEventDto): Event {
        return {} as Event;
    }

    update(id: number, updateEventDto: UpdateEventDto): boolean {
        return true;
    }

    remove(id: number): boolean {
        return true;
    }

    async findEventDetailsByEventIds(userId: number, eventIds: number[]): Promise<EventDetail[]> {
        const events = await this.eventDetailRepository.find({
            relations: {
                event: {
                    eventGroup: {
                        user: true
                    }
                }
            },
            where: {
                event: {
                    id: In(eventIds),
                    eventGroup: {
                        user: {
                            id: userId
                        }
                    }
                }
            }
        });

        return events;
    }
}
