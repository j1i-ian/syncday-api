/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { Observable, firstValueFrom, forkJoin, from, map, mergeMap } from 'rxjs';
import { DataSource, EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Availability } from '@core/entities/availability/availability.entity';
import { SearchByProfileOption } from '@interfaces/profiles/search-by-profile-option.interface';
import { Role } from '@interfaces/profiles/role.enum';
import { SearchTeamsWithOptions } from '@interfaces/teams/search-teams-with-options.interface';
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

@Injectable()
export class AvailabilityService {
    constructor(
        private readonly eventsService: EventsService,
        private readonly availabilityRedisRepository: AvailabilityRedisRepository,
        @InjectDataSource() private datasource: DataSource,
        @InjectRepository(Availability)
        private readonly availabilityRepository: Repository<Availability>
    ) {}

    search(
        searchOption: SearchTeamsWithOptions | Partial<SearchByProfileOption>,
        roles: Role[]
    ): Observable<Availability[]> {

        const hasTeamPermission = roles.includes(Role.MANAGER) || roles.includes(Role.OWNER);

        const availabilityCondition: FindOptionsWhere<Availability> = hasTeamPermission ?
            {
                profile: {
                    teamId: (searchOption as SearchTeamsWithOptions).teamId
                }
            } : {
                profileId: (searchOption as Partial<SearchByProfileOption>).profileId
            };

        return forkJoin({
            availabilityEntities: from(
                this.availabilityRepository.find({
                    relations: ['events'],
                    where: availabilityCondition,
                    order: {
                        default: 'DESC'
                    }
                })
            ),
            availabilityBodyRecord: from(
                this.availabilityRedisRepository.getAvailabilityBodyRecord((searchOption as SearchTeamsWithOptions).teamUUID)
            )
        }).pipe(
            map(({ availabilityEntities, availabilityBodyRecord }) =>
                availabilityEntities.map((availability) => {
                    const availabilityBodyKey = [availability.profileId, availability.uuid].join(':');
                    const availabilityBody = availabilityBodyRecord[availabilityBodyKey];

                    availability.availableTimes = availabilityBody.availableTimes;
                    availability.overrides = availabilityBody.overrides;

                    return availability;
                })
            )
        );
    }

    fetchDetail(
        teamUUID: string,
        profileId: number,
        availabilityId: number
    ): Observable<Availability> {
        return from(
            this.availabilityRepository.findOneByOrFail({
                id: availabilityId,
                profileId
            })
        ).pipe(
            mergeMap((availability) =>
                from(
                    this.availabilityRedisRepository.getAvailabilityBody(
                        teamUUID,
                        profileId,
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
                relations: ['events', 'profile.team', 'profile.team.teamSetting'],
                where: {
                    profile: {
                        team: {
                            teamSetting: {
                                workspace: teamWorkspace
                            }
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
                        availability.profile.team.uuid,
                        availability.profileId,
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
        teamUUID: string,
        profileId: number,
        { name, availableTimes, overrides, timezone }: CreateAvailabilityRequestDto,
        availabilityOptions: Pick<Availability, 'default'> = {
            default: false
        }
    ): Promise<Availability> {
        return this._create(
            this.availabilityRepository.manager,
            teamUUID,
            profileId,
            {
                name,
                availableTimes,
                overrides,
                timezone
            },
            availabilityOptions
        );
    }

    async _create(
        manager: EntityManager,
        teamUUID: string,
        profileId: number,
        { name, availableTimes, overrides, timezone }: CreateAvailabilityRequestDto,
        availabilityOptions: Pick<Availability, 'default'> = {
            default: false
        }
    ): Promise<Availability> {

        const _availabilityRepository = manager.getRepository(Availability);

        const newAvailabilityBody = {
            availableTimes,
            overrides
        } as AvailabilityBody;

        const savedAvailability = await _availabilityRepository.save({
            default: availabilityOptions.default,
            profileId,
            name,
            timezone
        });

        await this.availabilityRedisRepository.save(
            teamUUID,
            profileId,
            savedAvailability.uuid,
            newAvailabilityBody
        );

        savedAvailability.availableTimes = availableTimes;
        savedAvailability.overrides = overrides;

        return savedAvailability;
    }

    async update(
        teamUUID: string,
        profileId: number,
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

        const availability = await this.availabilityRepository.findOneByOrFail({
            id: availabilityId,
            profileId
        });

        const updateResult = await this.availabilityRepository.update(availabilityId, {
            default: availabilityDefault,
            name,
            timezone
        });

        if (updateResult.affected && updateResult.affected > 0) {
            await this.availabilityRedisRepository.set(
                teamUUID,
                profileId,
                availability.uuid,
                {
                    availableTimes,
                    overrides
                }
            );
        } else {
            throw new AvailabilityUpdateFailByEntityException(
                `Cannot update availability: ${availabilityId}`
            );
        }

        return true;
    }

    async patch(
        teamUUID: string,
        profileId: number,
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
                            profileId
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
            await this.availabilityRedisRepository.update(
                teamUUID,
                profileId,
                availability.uuid,
                {
                    availableTimes,
                    overrides
                }
            );
        }

        return true;
    }

    async patchAll(
        teamUUID: string,
        profileId: number,
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
                profileId,
                {
                    availableTimes,
                    overrides
                } as Partial<AvailabilityBody>
            );
        }

        return availabilityBodyUpdateSuccess;
    }

    async remove(
        teamUUID: string,
        profileId: number,
        availabilityId: number
    ): Promise<boolean> {
        const loadedAvailability = await this.availabilityRepository.findOne({
            where: {
                profileId,
                id: availabilityId
            }
        });

        if (loadedAvailability?.default) {
            throw new CannotDeleteDefaultAvailabilityException();
        }

        const defaultAvailability = await this.availabilityRepository.findOneByOrFail({
            profileId,
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
                profileId,
                loadedAvailability.uuid
            );
        }

        return true;
    }

    async clone(
        teamId: number,
        teamUUID: string,
        profileId: number,
        availabilityId: number,
        { cloneSuffix }: CloneAvailabilityRequestDto
    ): Promise<Availability> {

        const availability = await this.availabilityRepository.findOneByOrFail({
            id: availabilityId,
            profile: {
                teamId
            }
        });

        const { id: _availabilityId, uuid: _availabilityUUID, ...newAvailability } = availability;

        newAvailability.default = false;
        newAvailability.name += cloneSuffix;

        const clonedAvailability = await this.availabilityRepository.save(newAvailability);

        const clonedAvailabilityBody = await firstValueFrom(
            this.availabilityRedisRepository.clone(
                teamUUID,
                profileId,
                availability.uuid,
                clonedAvailability.uuid
            )
        );

        clonedAvailability.availableTimes = clonedAvailabilityBody.availableTimes;
        clonedAvailability.overrides = clonedAvailabilityBody.overrides;

        return clonedAvailability;
    }

    async linkToEvents(
        teamId: number,
        profileId: number,
        availabilityId: number,
        eventIds: number[]
    ): Promise<boolean> {
        // validate owner
        await this.eventsService.hasOwnEventsOrThrow(teamId, eventIds);

        const defaultAvailability = await this.availabilityRepository.findOneByOrFail({
            profileId,
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

    async unlinkToEvents(profileId: number, availabilityId: number): Promise<boolean> {
        // validate owner
        const defaultAvailability = await this.availabilityRepository.findOneByOrFail({
            profileId,
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
