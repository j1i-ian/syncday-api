/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { Observable, forkJoin, from, map, mergeMap } from 'rxjs';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Availability } from '@core/entities/availability/availability.entity';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { CreateAvailabilityRequestDto } from '@dto/availability/create-availability-request.dto';
import { UpdateAvailabilityRequestDto } from '@dto/availability/update-availability-request.dto';
import { AvailabilitySearchOption } from '@app/interfaces/availability/availability-search-option.interface';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';
import { AvailabilityUpdateFailByEntityException } from '@app/exceptions/availability-update-fail-by-entity.exception';

@Injectable()
export class AvailabilityService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @InjectRepository(Availability)
        private readonly availabilityRepository: Repository<Availability>
    ) {}

    search(
        searchOption: AvailabilitySearchOption = {
            userId: 0,
            userUUID: ''
        }
    ): Observable<Availability[]> {
        return forkJoin({
            availabilityEntities: this.availabilityRepository.find({
                where: {
                    userId: searchOption.userId
                }
            }),
            availabilityBodyRecord: this.syncdayRedisService.getAvailabilityBodyRecord(
                searchOption.userUUID
            )
        }).pipe(
            map(({ availabilityEntities, availabilityBodyRecord }) =>
                availabilityEntities.map((availability) => {
                    const availabilityBody = availabilityBodyRecord[availability.uuid];

                    availability.availableTimes = availabilityBody.availableTimes;
                    availability.overrides = availabilityBody.overrides;

                    return availability;
                })
            )
        );
    }

    fetchDetail(
        availabilityId: number,
        userId: number,
        userUUID: string
    ): Observable<Availability> {
        return from(
            this.availabilityRepository.findOneByOrFail({
                id: availabilityId,
                userId
            })
        ).pipe(
            mergeMap((availability) =>
                from(this.syncdayRedisService.getAvailability(availability.uuid, userUUID)).pipe(
                    map((availabilityBody) => {
                        availability.availableTimes = availabilityBody.availableTimes;
                        availability.overrides = availabilityBody.overrides;
                        return availability;
                    })
                )
            )
        );
    }

    async create(
        userId: number,
        userUUID: string,
        { name, availableTimes, overrides }: CreateAvailabilityRequestDto
    ): Promise<Availability> {
        const newAvailabilityBody = {
            availableTimes,
            overrides
        } as AvailabilityBody;

        const savedAvailability = await this.availabilityRepository.save({
            userId,
            name
        });

        await this.syncdayRedisService.setAvailability(
            savedAvailability.uuid,
            userUUID,
            newAvailabilityBody
        );

        savedAvailability.availableTimes = availableTimes;
        savedAvailability.overrides = overrides;

        return savedAvailability;
    }

    async update(
        availabilityId: number,
        userUUID: string,
        updateAvailabilityDto: UpdateAvailabilityRequestDto
    ): Promise<boolean> {
        const {
            availableTimes,
            overrides,
            name,
            timezone,
            default: availabilityDefault
        } = updateAvailabilityDto;

        const availability = await this.availabilityRepository.findOneByOrFail({
            id: availabilityId
        });

        const updateResult = await this.availabilityRepository.update(availabilityId, {
            default: availabilityDefault,
            name,
            timezone
        });

        if (updateResult.affected && updateResult.affected > 0) {
            await this.syncdayRedisService.setAvailability(availability.uuid, userUUID, {
                availableTimes,
                overrides
            });
        } else {
            throw new AvailabilityUpdateFailByEntityException(
                `Cannot update availability: ${availabilityId}`
            );
        }

        return true;
    }

    async remove(availabilityId: number, userId: number, userUUID: string): Promise<boolean> {
        const loadedAvailability = await this.availabilityRepository.findOne({
            where: {
                userId,
                id: availabilityId
            }
        });

        const deleteResult = await this.availabilityRepository.delete(availabilityId);

        if (loadedAvailability && deleteResult.affected && deleteResult.affected > 0) {
            await this.syncdayRedisService.deleteAvailability(loadedAvailability.uuid, userUUID);
        }

        return true;
    }
}
