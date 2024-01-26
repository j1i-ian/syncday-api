import { Repository } from 'typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserSetting } from '@entities/users/user-setting.entity';
import { PatchUserSettingRequestDto } from '@dto/users/user-settings/patch-user-setting-request.dto';

@Injectable()
export class UserSettingService {
    constructor(
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
