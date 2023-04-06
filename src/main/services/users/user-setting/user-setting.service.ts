import { Injectable } from '@nestjs/common';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { UpdateUserSettingDto } from '@dto/users/user-settings/dto/update-user-setting.dto';

@Injectable()
export class UserSettingService {
    async fetchUserSetting(userId: number): Promise<UserSetting> {
        return Promise.resolve({} as UserSetting);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async update(userId: number, updateUserSettingDto: UpdateUserSettingDto): Promise<boolean> {
        return Promise.resolve(true);
    }
}
