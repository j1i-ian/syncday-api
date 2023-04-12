/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserService } from '@services/users/user.service';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { DatetimePreset } from '@entity/datetime-presets/datetime-preset.entity';
import { CreateDatetimePresetRequestDto } from '@dto/datetime-presets/create-datetime-preset-request.dto';

@Injectable()
export class DatetimePresetsService {
    constructor(
        private readonly dataSource: DataSource,
        private readonly userService: UserService,
        private readonly syncdayRedisService: SyncdayRedisService
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
}
