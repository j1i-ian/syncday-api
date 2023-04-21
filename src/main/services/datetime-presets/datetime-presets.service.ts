/* eslint-disable @typescript-eslint/no-unused-vars */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserService } from '@services/users/user.service';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsService } from '@services/event-groups/events/events.service';
import { DatetimePreset } from '@entity/datetime-presets/datetime-preset.entity';
import { CreateDatetimePresetRequestDto } from '@dto/datetime-presets/create-datetime-preset-request.dto';
import { UpdateDatetimePresetRequestDto } from '@dto/datetime-presets/update-datetime-preset-request.dto';
@Injectable()
export class DatetimePresetsService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly userService: UserService,
        private readonly syncdayRedisService: SyncdayRedisService,
        private readonly eventsService: EventsService,
        @InjectRepository(DatetimePreset)
        private readonly datetimePresetRepository: Repository<DatetimePreset>
    ) {}

    async createDatetimePreset(
        userId: number,
        createDatetimePresetRequestDto: CreateDatetimePresetRequestDto
    ): Promise<DatetimePreset> {
        const user = await this.userService.findUserById(userId);

        const createdDatetimePreset = await this.dataSource.transaction(async (manager) => {
            const newDatetimePreset = new DatetimePreset();
            newDatetimePreset.name = createDatetimePresetRequestDto.name;
            newDatetimePreset.user = user;

            const createResult = await manager.save(newDatetimePreset);
            const { timepreset, overrides } = createDatetimePresetRequestDto;

            await this.syncdayRedisService.setDatetimePreset(createResult.uuid, {
                timepreset,
                overrides
            });
            createResult.timepreset = timepreset;
            createResult.overrides = overrides;

            return createResult;
        });

        return createdDatetimePreset;
    }

    async getDatetimePresets(userId: number): Promise<DatetimePreset[]> {
        const datetimePresets = await this.datetimePresetRepository.find({
            relations: {
                user: true
            },
            where: {
                user: {
                    id: userId
                }
            }
        });
        const uuids = datetimePresets.map((datetimePreset) => datetimePreset.uuid);
        const datetimePresetTimeRange = await this.syncdayRedisService.getDatetimePresets(uuids);

        const datetimePresetWithTimeRange = datetimePresets.map((datetimePreset, index) => {
            const _datetimePreset = this.datetimePresetRepository.create(datetimePreset);
            const _datetimePresetTimeRange = datetimePresetTimeRange[index];
            if (_datetimePresetTimeRange !== null) {
                _datetimePreset.timepreset = _datetimePresetTimeRange.timepreset;
                _datetimePreset.overrides = _datetimePresetTimeRange.overrides;
            }

            return _datetimePreset;
        });

        return datetimePresetWithTimeRange;
    }

    async getDatetimePreset(userId: number, datetimePresetId: number): Promise<DatetimePreset> {
        const datetimePreset = await this.findDateTimePresetById(userId, datetimePresetId);

        const datetimeRange = await this.syncdayRedisService.getDatetimePreset(datetimePreset.uuid);

        datetimePreset.timepreset = datetimeRange.timepreset;
        datetimePreset.overrides = datetimeRange.overrides;

        return datetimePreset;
    }

    /**
     * 새로운 default time preset 을 설정할 경우, 이전 default 설정은 제거한다.
     */
    async updateDatetimePreset(
        userId: number,
        datetimePresetId: number,
        updateDateTimePresetRequestDto: UpdateDatetimePresetRequestDto
    ): Promise<boolean> {
        const datetimePreset = await this.findDateTimePresetById(userId, datetimePresetId);
        // User 는 default time preset 을 활성화(true)만 할 수 있고 비활성화(false)는 할 수 없다.
        const isDisableDefaultTimePresetRequset =
            datetimePreset.default && updateDateTimePresetRequestDto.default === false;

        if (isDisableDefaultTimePresetRequset) {
            throw new BadRequestException('cannot remove default datetime preset setting');
        }

        const updatedDatetimePreset = await this.dataSource.transaction(async (manager) => {
            const _datetimePresetRepository = manager.getRepository(DatetimePreset);
            const { name, timezone, overrides, timepreset } = updateDateTimePresetRequestDto;

            const isEnableDefaultTimePresetRequest =
                updateDateTimePresetRequestDto.default === true;

            if (isEnableDefaultTimePresetRequest) {
                await _datetimePresetRepository.update(
                    {
                        default: true,
                        userId
                    },
                    {
                        default: false
                    }
                );
            }

            const _updatedDatetimePreset = await _datetimePresetRepository.save({
                ...datetimePreset,
                name,
                timezone,
                default: updateDateTimePresetRequestDto.default
            });

            await this.syncdayRedisService.setDatetimePreset(_updatedDatetimePreset.uuid, {
                overrides,
                timepreset
            });

            return _updatedDatetimePreset;
        });

        return updatedDatetimePreset ? true : false;
    }

    /**
     * Before delete, update event_detail's datetime_preset_id to default datetime_preset_id
     * cannot delete default datetime preset
     */
    async deleteDatetimePreset(userId: number, datetimePresetId: number): Promise<boolean> {
        const datetimePreset = await this.findDateTimePresetById(userId, datetimePresetId);
        const defaultDatetimePreset = await this.findDefaultDatetimePreset(userId);
        if (datetimePreset.default) {
            throw new BadRequestException('cannot delete default datetime preset');
        } else if (!defaultDatetimePreset) {
            throw new NotFoundException('cannot find default datetime preset');
        }

        const removeResult = await this.dataSource.transaction(async (manager) => {
            const _datetimePresetRepository = manager.getRepository(DatetimePreset);
            const beChangedEventIds = datetimePreset.events.map((event) => event.id);

            await this.eventsService.updateDatetimePresetRelation(
                beChangedEventIds,
                userId,
                defaultDatetimePreset.id
            );

            return await _datetimePresetRepository.remove(datetimePreset);
        });

        return removeResult ? true : false;
    }

    async linkDatetimePresetWithEvents(
        userId: number,
        datetimePresetId: number,
        eventIdStrArray: string[]
    ): Promise<boolean> {
        const eventIds = eventIdStrArray.map((e) => +e);
        const datetimePreset = await this.findDateTimePresetById(userId, datetimePresetId);

        const updateResult = await this.eventsService.updateDatetimePresetRelation(
            eventIds,
            userId,
            datetimePreset.id
        );

        return updateResult.affected && updateResult.affected > 0 ? true : false;
    }

    async unlinkDatetimePresetWithEvents(
        userId: number,
        datetimePresetId: number,
        eventIdStrArray: string[]
    ): Promise<boolean> {
        const datetimePreset = await this.findDateTimePresetById(userId, datetimePresetId);
        const defaultDatetimePreset = await this.findDefaultDatetimePreset(userId);

        if (datetimePreset.default) {
            throw new BadRequestException('cannot unlink default datetime preset');
        } else if (defaultDatetimePreset === null) {
            throw new NotFoundException('cannot find default datetime preset');
        }

        const eventIds = eventIdStrArray.map((e) => +e);

        const updateResult = await this.eventsService.updateDatetimePresetRelation(
            eventIds,
            userId,
            defaultDatetimePreset.id
        );

        return updateResult.affected && updateResult.affected > 0 ? true : false;
    }

    async findDateTimePresetById(
        userId: number,
        datetimePresetId: number
    ): Promise<DatetimePreset> {
        const datetimePreset = await this.datetimePresetRepository.findOneOrFail({
            relations: {
                user: true,
                events: true
            },
            where: {
                user: {
                    id: userId
                },
                id: datetimePresetId
            }
        });

        return datetimePreset;
    }

    async findDefaultDatetimePreset(userId: number): Promise<DatetimePreset | null> {
        const defaultDatetimePreset = await this.datetimePresetRepository.findOne({
            relations: {
                user: true,
                events: true
            },
            where: {
                user: {
                    id: userId
                },
                default: true
            }
        });

        return defaultDatetimePreset;
    }
}
