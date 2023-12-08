import { Repository } from 'typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { SyncdayRedisService } from '../../syncday-redis/syncday-redis.service';
import { PatchUserSettingRequestDto } from '@share/@dto/users/user-settings/patch-user-setting-request.dto';

@Injectable()
export class UserSettingService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @InjectRepository(UserSetting)
        private readonly userSettingRepository: Repository<UserSetting>
    ) {}

    async fetchUserSettingByUserId(userId: number): Promise<UserSetting> {
        const loadedUserSetting = await this.userSettingRepository.findOneOrFail({
            relations: [
                'user'
            ],
            where: {
                userId
            }
        });

        if (loadedUserSetting === null) {
            throw new NotFoundException('User settings do not exist');
        }

        return loadedUserSetting;
    }

    async patchUserSettingByUserId(
        userId: number,
        patchUserSettingRequestDto: PatchUserSettingRequestDto
    ): Promise<boolean> {
        const updateResult = await this.userSettingRepository.update(
            { userId },
            patchUserSettingRequestDto as Partial<UserSetting>
        );

        return updateResult.affected ? updateResult.affected > 0 : false;
    }
}
