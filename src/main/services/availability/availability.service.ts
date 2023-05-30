/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { Observable, firstValueFrom, forkJoin, from, map, mergeMap } from 'rxjs';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Availability } from '@core/entities/availability/availability.entity';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { EventsService } from '@services/events/events.service';
import { CreateAvailabilityRequestDto } from '@dto/availability/create-availability-request.dto';
import { UpdateAvailabilityRequestDto } from '@dto/availability/update-availability-request.dto';
import { PatchAvailabilityRequestDto } from '@dto/availability/patch-availability-request.dto';
import { CloneAvailabilityRequestDto } from '@dto/availability/clone-availability-options.dto';
import { AvailabilitySearchOption } from '@app/interfaces/availability/availability-search-option.interface';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';
import { AvailabilityUpdateFailByEntityException } from '@app/exceptions/availability-update-fail-by-entity.exception';
import { NoDefaultAvailabilityException } from '@app/exceptions/availability/no-default-availability.exception';
import { CannotDeleteDefaultAvailabilityException } from '@app/exceptions/availability/cannot-delete-default-availability.exception';
import { CannotUnlinkDefaultAvailabilityException } from '@app/exceptions/availability/cannot-unlink-default-availability.exception';
import { Validator } from '@criteria/validator';

@Injectable()
export class AvailabilityService {
    constructor(
        private readonly validator: Validator,
        private readonly eventsService: EventsService,
        private readonly availabilityRedisRepository: AvailabilityRedisRepository,
        @InjectDataSource() private datasource: DataSource,
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
            availabilityEntities: from(
                this.availabilityRepository.find({
                    relations: ['events'],
                    where: {
                        userId: searchOption.userId
                    },
                    order: {
                        default: 'DESC'
                    }
                })
            ),
            availabilityBodyRecord: from(
                this.availabilityRedisRepository.getAvailabilityBodyRecord(searchOption.userUUID)
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
                from(
                    this.availabilityRedisRepository.getAvailabilityBody(
                        availability.uuid,
                        userUUID
                    )
                ).pipe(
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

        await this.availabilityRedisRepository.save(
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
        userId: number,
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

        await this.validator.validate(userId, availabilityId, Availability);

        const availability = await this.availabilityRepository.findOneByOrFail({
            id: availabilityId
        });

        const updateResult = await this.availabilityRepository.update(availabilityId, {
            default: availabilityDefault,
            name,
            timezone
        });

        if (updateResult.affected && updateResult.affected > 0) {
            await this.availabilityRedisRepository.save(availability.uuid, userUUID, {
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

    async patch(
        availabilityId: number,
        userId: number,
        userUUID: string,
        patchAvailabilityDto: PatchAvailabilityRequestDto
    ): Promise<boolean> {
        const {
            default: isDefault,
            name,
            timezone,
            availableTimes,
            overrides
        } = patchAvailabilityDto;

        const availability = await this.availabilityRepository.findOneByOrFail({
            id: availabilityId
        });

        const isNoDefaultAvailabilityRequest =
            availability.default === true && patchAvailabilityDto.default === false;
        const shouldRDBUpdate = isDefault !== undefined || name || timezone;

        // validation
        if (isNoDefaultAvailabilityRequest) {
            throw new NoDefaultAvailabilityException(
                'Default availability cannot set default as false'
            );
        }

        if (shouldRDBUpdate) {
            const patchedAvailability = Object.assign(availability, patchAvailabilityDto);

            await this.datasource.transaction(async (transactionManager) => {
                const _availabilityRepository = transactionManager.getRepository(Availability);

                if (availability.default) {
                    await _availabilityRepository.update(
                        {
                            userId
                        },
                        {
                            default: false
                        }
                    );
                }

                await _availabilityRepository.update(availabilityId, {
                    default: patchedAvailability.default,
                    name: patchedAvailability.name,
                    timezone: patchedAvailability.timezone
                });
            });
        }

        /**
         * TDDO: it should be split into another api.
         * Notice availability uuid is fetched from rdb
         */
        if (availableTimes && overrides) {
            await this.availabilityRedisRepository.save(availability.uuid, userUUID, {
                availableTimes,
                overrides
            });
        }

        return true;
    }

    async patchAll(
        userId: number,
        userUUID: string,
        { availableTimes, overrides }: PatchAvailabilityRequestDto
    ): Promise<boolean> {
        /**
         * TDDO: it should be split into another api.
         * Notice availability uuid is fetched from rdb
         */
        let availabilityBodyUpdateSuccess = false;

        if (availableTimes && overrides) {
            availabilityBodyUpdateSuccess = await this.availabilityRedisRepository.saveAll(
                userUUID,
                {
                    availableTimes,
                    overrides
                }
            );
        }

        return availabilityBodyUpdateSuccess;
    }

    async remove(availabilityId: number, userId: number, userUUID: string): Promise<boolean> {
        const loadedAvailability = await this.availabilityRepository.findOne({
            where: {
                userId,
                id: availabilityId
            }
        });

        if (loadedAvailability?.default) {
            throw new CannotDeleteDefaultAvailabilityException();
        }

        const deleteResult = await this.availabilityRepository.delete(availabilityId);

        if (loadedAvailability && deleteResult.affected && deleteResult.affected > 0) {
            await this.availabilityRedisRepository.deleteAvailabilityBody(
                loadedAvailability.uuid,
                userUUID
            );
        }

        return true;
    }

    async clone(
        availabilityId: number,
        userId: number,
        userUUID: string,
        { cloneSuffix }: CloneAvailabilityRequestDto
    ): Promise<Availability> {
        const validatedAvailability = await this.validator.validate(
            userId,
            availabilityId,
            Availability
        );

        const { id: _eventId, uuid: _eventUUID, ...newAvailability } = validatedAvailability;

        newAvailability.default = false;
        newAvailability.name += cloneSuffix;

        const clonedAvailability = await this.availabilityRepository.save(newAvailability);

        const clonedAvailabilityBody = await firstValueFrom(
            this.availabilityRedisRepository.clone(
                userUUID,
                validatedAvailability.uuid,
                clonedAvailability.uuid
            )
        );

        clonedAvailability.availableTimes = clonedAvailabilityBody.availableTimes;
        clonedAvailability.overrides = clonedAvailabilityBody.overrides;

        return clonedAvailability;
    }

    async linkToEvents(
        userId: number,
        availabilityId: number,
        eventIds: number[]
    ): Promise<boolean> {
        // validate owner
        await this.validator.validate(userId, availabilityId, Availability);

        await this.eventsService.hasOwnEventsOrThrow(userId, eventIds);

        const defaultAvailability = await this.availabilityRepository.findOneByOrFail({
            userId,
            default: true
        });

        await this.eventsService.linksToAvailability(
            userId,
            eventIds,
            availabilityId,
            defaultAvailability.id
        );

        return false;
    }

    async unlinkToEvents(userId: number, availabilityId: number): Promise<boolean> {
        // validate owner
        await this.validator.validate(userId, availabilityId, Availability);

        const defaultAvailability = await this.availabilityRepository.findOneByOrFail({
            userId,
            default: true
        });

        if (defaultAvailability.id === availabilityId) {
            throw new CannotUnlinkDefaultAvailabilityException();
        }

        const result = await this.eventsService.unlinksToAvailability(
            availabilityId,
            defaultAvailability.id
        );

        return result;
    }
}
