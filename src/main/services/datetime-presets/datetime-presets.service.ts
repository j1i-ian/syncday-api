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

/**
 * relation type naming reference
 *
 * @see {@link [RFC8288](https://www.rfc-editor.org/rfc/rfc8288#section-3.3)}
 *
 */
enum LinkHeaderRelation {
    FOREIGNKEY = 'foreign-key'
}

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

            return { ...createResult, timepreset, overrides };
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

        const datetimePresetWithTimeRange = await Promise.all(
            datetimePresets.map(async (datetimePreset) => {
                const datetimeRange = await this.syncdayRedisService.getDatetimePreset(
                    datetimePreset.uuid
                );

                return { ...datetimePreset, ...datetimeRange };
            })
        );

        return datetimePresetWithTimeRange;
    }

    async getDatetimePreset(userId: number, datetimePresetId: number): Promise<DatetimePreset> {
        const datetimePreset = await this.findDateTimePresetById(userId, datetimePresetId);

        const datetimeRange = await this.syncdayRedisService.getDatetimePreset(datetimePreset.uuid);

        const datetimePresetWithTimeRange = { ...datetimePreset, ...datetimeRange };

        return datetimePresetWithTimeRange;
    }

    async updateDatetimePreset(
        userId: number,
        datetimePresetId: number,
        updateDateTimePresetRequestDto: UpdateDatetimePresetRequestDto
    ): Promise<{ affected: boolean }> {
        const datetimePreset = await this.findDateTimePresetById(userId, datetimePresetId);

        const updateResult = await this.dataSource.transaction(async (manager) => {
            const _datetimePresetRepository = manager.getRepository(DatetimePreset);
            const { name, timezone, overrides, timepreset } = updateDateTimePresetRequestDto;

            const updatedDatetimePreset = await _datetimePresetRepository.save({
                ...datetimePreset,
                name,
                timezone,
                default: updateDateTimePresetRequestDto.default
            });

            await this.syncdayRedisService.setDatetimePreset(updatedDatetimePreset.uuid, {
                overrides,
                timepreset
            });

            return updatedDatetimePreset;
        });

        return { affected: updateResult ? true : false };
    }

    /**
     *
     * @description Before delete, update event_detail's datetime_preset_id to default datetime_preset_id
     * cannot delete default datetime preset
     */
    async deleteDatetimePreset(
        userId: number,
        datetimePresetId: number
    ): Promise<{
        affected: boolean;
    }> {
        const datetimePreset = await this.findDateTimePresetById(userId, datetimePresetId);
        const defaultDatetimePreset = await this.findDefaultDatetimePreset(userId);
        if (datetimePreset.default) {
            throw new BadRequestException('cannot delete default datetime preset');
        } else if (!defaultDatetimePreset) {
            throw new NotFoundException('cannot find default datetime preset');
        }

        const removeResult = await this.dataSource.transaction(async (manager) => {
            const _datetimePresetRepository = manager.getRepository(DatetimePreset);

            defaultDatetimePreset.eventDetails = [
                ...defaultDatetimePreset.eventDetails,
                ...datetimePreset.eventDetails
            ];
            await _datetimePresetRepository.save(defaultDatetimePreset);

            return await _datetimePresetRepository.remove(datetimePreset);
        });

        return { affected: removeResult ? true : false };
    }

    async linkDatetimePresetWithEvents(
        userId: number,
        datetimePresetId: number,
        parsedLink: { [key: string]: string[] }
    ): Promise<{ affected: boolean }> {
        const eventIds = this._getEventIdFromHeader(parsedLink);
        const datetimePreset = await this.findDateTimePresetById(userId, datetimePresetId);

        const eventDetails = await this.eventsService.findEventDetailsByEventIds(userId, eventIds);

        datetimePreset.eventDetails = [...datetimePreset.eventDetails, ...eventDetails];

        const updateResult = await this.datetimePresetRepository.save(datetimePreset);

        return { affected: updateResult ? true : false };
    }

    async unlinkDatetimePresetWithEvents(
        userId: number,
        datetimePresetId: number,
        parsedLink: { [key: string]: string[] }
    ): Promise<{ affected: boolean }> {
        const datetimePreset = await this.findDateTimePresetById(userId, datetimePresetId);
        const defaultDatetimePreset = await this.findDefaultDatetimePreset(userId);
        if (datetimePreset.default) {
            throw new BadRequestException('cannot unlink default datetime preset');
        } else if (defaultDatetimePreset === null) {
            throw new NotFoundException('cannot find default datetime preset');
        }

        const eventIds = this._getEventIdFromHeader(parsedLink);
        const eventDetails = await this.eventsService.findEventDetailsByEventIds(userId, eventIds);

        defaultDatetimePreset.eventDetails = [
            ...defaultDatetimePreset.eventDetails,
            ...eventDetails
        ];

        const updateResult = await this.datetimePresetRepository.save(defaultDatetimePreset);

        return { affected: updateResult ? true : false };
    }

    async findDateTimePresetById(
        userId: number,
        datetimePresetId: number
    ): Promise<DatetimePreset> {
        const datetimePreset = await this.datetimePresetRepository.findOneOrFail({
            relations: {
                user: true,
                eventDetails: true
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
                eventDetails: true
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

    _getEventIdFromHeader(parsedLinkHeader: { [key: string]: string[] }): number[] {
        const eventUrls = parsedLinkHeader[LinkHeaderRelation.FOREIGNKEY];
        const eventIds = eventUrls.map((eventUrl) => {
            const split = eventUrl.split('/');

            return +split[1];
        });
        return eventIds ? eventIds : [];
    }
}
