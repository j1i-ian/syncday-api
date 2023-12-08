/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { Observable, firstValueFrom, forkJoin, from, map, mergeMap } from 'rxjs';
import { DataSource, Repository } from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Availability } from '@core/entities/availability/availability.entity';
import { SearchByTeamOption } from '@interfaces/teams/search-by-team-option.interface';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { EventsService } from '@services/events/events.service';
import { CreateAvailabilityRequestDto } from '@dto/availability/create-availability-request.dto';
import { UpdateAvailabilityRequestDto } from '@dto/availability/update-availability-request.dto';
import { PatchAvailabilityRequestDto } from '@dto/availability/patch-availability-request.dto';
import { CloneAvailabilityRequestDto } from '@dto/availability/clone-availability-options.dto';
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
        searchOption: SearchByTeamOption = {
            teamId: 0,
            teamUUID: ''
        }
    ): Observable<Availability[]> {
        return forkJoin({
            availabilityEntities: from(
                this.availabilityRepository.find({
                    relations: ['events'],
                    where: {
                        teamId: searchOption.teamId
                    },
                    order: {
                        default: 'DESC'
                    }
                })
            ),
            availabilityBodyRecord: from(
                this.availabilityRedisRepository.getAvailabilityBodyRecord(searchOption.teamUUID)
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
        teamId: number,
        teamUUID: string,
        availabilityId: number
    ): Observable<Availability> {
        return from(
            this.availabilityRepository.findOneByOrFail({
                id: availabilityId,
                teamId
            })
        ).pipe(
            mergeMap((availability) =>
                from(
                    this.availabilityRedisRepository.getAvailabilityBody(
                        teamUUID,
                        availability.uuid
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

    fetchDetailByTeamWorkspaceAndLink(
        teamWorkspace: string,
        eventLink: string
    ): Observable<Availability> {
        return from(
            this.availabilityRepository.findOneOrFail({
                relations: ['user'],
                where: {
                    team: {
                        teamSetting: {
                            workspace: teamWorkspace
                        }
                    },
                    events: {
                        link: eventLink
                    }
                }
            })
        ).pipe(
            mergeMap((availability) =>
                from(
                    this.availabilityRedisRepository.getAvailabilityBody(
                        availability.team.uuid,
                        availability.uuid
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
        { name, availableTimes, overrides, timezone }: CreateAvailabilityRequestDto
    ): Promise<Availability> {
        const newAvailabilityBody = {
            availableTimes,
            overrides
        } as AvailabilityBody;

        const savedAvailability = await this.availabilityRepository.save({
            userId,
            name,
            timezone
        });

        await this.availabilityRedisRepository.save(
            userUUID,
            savedAvailability.uuid,
            newAvailabilityBody
        );

        savedAvailability.availableTimes = availableTimes;
        savedAvailability.overrides = overrides;

        return savedAvailability;
    }

    async update(
        userId: number,
        userUUID: string,
        availabilityId: number,
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
            await this.availabilityRedisRepository.set(userUUID, availability.uuid, {
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
        teamId: number,
        teamUUID: string,
        availabilityId: number,
        patchAvailabilityDto: PatchAvailabilityRequestDto
    ): Promise<boolean> {
        const {
            default: isDefault,
            name,
            timezone,
            availableTimes,
            overrides,
            priority
        } = patchAvailabilityDto;

        const availability = await this.availabilityRepository.findOneByOrFail({
            id: availabilityId
        });

        const isNoDefaultAvailabilityRequest =
            availability.default === true && patchAvailabilityDto.default === false;
        const shouldRDBUpdate = isDefault !== undefined || name || timezone || priority;

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
                            teamId
                        },
                        {
                            default: false
                        }
                    );
                }

                await _availabilityRepository.update(availabilityId, {
                    default: patchedAvailability.default,
                    name: patchedAvailability.name,
                    timezone: patchedAvailability.timezone,
                    priority: patchedAvailability.priority
                });
            });
        }

        /**
         * TDDO: it should be split into another api.
         * Notice availability uuid is fetched from rdb
         */
        if (availableTimes && overrides) {
            await this.availabilityRedisRepository.update(teamUUID, availability.uuid, {
                availableTimes,
                overrides
            });
        }

        return true;
    }

    async patchAll(
        teamUUID: string,
        { availableTimes, overrides }: PatchAvailabilityRequestDto
    ): Promise<boolean> {
        /**
         * TDDO: it should be split into another api.
         * Notice availability uuid is fetched from rdb
         */
        let availabilityBodyUpdateSuccess = false;

        if (availableTimes || overrides) {
            availabilityBodyUpdateSuccess = await this.availabilityRedisRepository.updateAll(
                teamUUID,
                {
                    availableTimes,
                    overrides
                } as Partial<AvailabilityBody>
            );
        }

        return availabilityBodyUpdateSuccess;
    }

    async remove(availabilityId: number, teamId: number, teamUUID: string): Promise<boolean> {
        const loadedAvailability = await this.availabilityRepository.findOne({
            where: {
                teamId,
                id: availabilityId
            }
        });

        if (loadedAvailability?.default) {
            throw new CannotDeleteDefaultAvailabilityException();
        }

        const defaultAvailability = await this.availabilityRepository.findOneByOrFail({
            teamId,
            default: true
        });

        const deleteSuccess = await this.datasource.transaction(async (transactionManager) => {

            const _availabilityRepository = transactionManager.getRepository(Availability);

            const result = await this.eventsService._unlinksToAvailability(
                transactionManager,
                availabilityId,
                defaultAvailability.id
            );

            const _deleteResult = await _availabilityRepository.delete(availabilityId);

            return result && !!(_deleteResult && _deleteResult.affected && _deleteResult.affected > 0);
        });

        if (loadedAvailability && deleteSuccess) {
            await this.availabilityRedisRepository.deleteAvailabilityBody(
                teamUUID,
                loadedAvailability.uuid
            );
        }

        return true;
    }

    async clone(
        availabilityId: number,
        teamId: number,
        teamUUID: string,
        { cloneSuffix }: CloneAvailabilityRequestDto
    ): Promise<Availability> {
        const validatedAvailability = await this.validator.validate(
            teamId,
            availabilityId,
            Availability
        );

        const { id: _eventId, uuid: _eventUUID, ...newAvailability } = validatedAvailability;

        newAvailability.default = false;
        newAvailability.name += cloneSuffix;

        const clonedAvailability = await this.availabilityRepository.save(newAvailability);

        const clonedAvailabilityBody = await firstValueFrom(
            this.availabilityRedisRepository.clone(
                teamUUID,
                validatedAvailability.uuid,
                clonedAvailability.uuid
            )
        );

        clonedAvailability.availableTimes = clonedAvailabilityBody.availableTimes;
        clonedAvailability.overrides = clonedAvailabilityBody.overrides;

        return clonedAvailability;
    }

    async linkToEvents(
        teamId: number,
        availabilityId: number,
        eventIds: number[]
    ): Promise<boolean> {
        // validate owner
        await this.validator.validate(teamId, availabilityId, Availability);

        await this.eventsService.hasOwnEventsOrThrow(teamId, eventIds);

        const defaultAvailability = await this.availabilityRepository.findOneByOrFail({
            teamId,
            default: true
        });

        await this.eventsService.linksToAvailability(
            teamId,
            eventIds,
            availabilityId,
            defaultAvailability.id
        );

        return false;
    }

    async unlinkToEvents(teamId: number, availabilityId: number): Promise<boolean> {
        // validate owner
        await this.validator.validate(teamId, availabilityId, Availability);

        const defaultAvailability = await this.availabilityRepository.findOneByOrFail({
            teamId,
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
