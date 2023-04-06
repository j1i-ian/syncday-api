import { Injectable } from '@nestjs/common';
import { Repository, UpdateResult } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserSetting } from '@core/entities/users/user-setting.entity';

@Injectable()
export class UserSettingService {
    constructor(
        @InjectRepository(UserSetting)
        private readonly userSettingRepository: Repository<UserSetting>
    ) {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async fetchUserSetting(userId: number): Promise<UserSetting> {
        return Promise.resolve({} as UserSetting);
    }

    async updateUserSetting(
        userId: number,
        newUserSetting: Partial<UserSetting>
    ): Promise<UpdateResult> {
        return await this.userSettingRepository.update({ userId }, { ...newUserSetting });
    }
}
