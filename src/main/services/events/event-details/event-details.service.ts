import { Injectable } from '@nestjs/common';
import { EntityNotFoundError, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { EventDetail } from '@entity/events/event-detail.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';

@Injectable()
export class EventDetailsService {
    constructor(
        private readonly eventRedisRepository: EventsRedisRepository,
        @InjectRepository(EventDetail) private readonly eventDetailRepository: Repository<EventDetail>
    ) {}

    async patch(
        eventDetailId: number,
        teamId: number,
        updateEventDetail: Partial<EventDetail>
    ): Promise<boolean> {

        try {

            const loadedEventDetail = await this.eventDetailRepository.findOneOrFail({
                relations: ['event'],
                where: {
                    id: eventDetailId,
                    event: {
                        eventGroup: {
                            teamId
                        }
                    }
                }
            });

            const { eventSetting, hostQuestions, notificationInfo, ...eventDetailRelationEntity } = updateEventDetail;

            const updateResult = await this.eventDetailRepository.update(loadedEventDetail.id, eventDetailRelationEntity);

            const updateSuccess = updateResult && updateResult.affected && updateResult.affected > 0;

            if (eventSetting || hostQuestions || notificationInfo) {
                this.eventRedisRepository.updateEventDetailBody(loadedEventDetail.uuid, {
                    hostQuestions,
                    notificationInfo,
                    eventSetting
                });
            }

            return updateSuccess === true;
        } catch (errorOrException: EntityNotFoundError | unknown) {
            if (errorOrException instanceof EntityNotFoundError) {
                throw new NotAnOwnerException();
            } else {
                throw errorOrException;
            }
        }


    }
}
