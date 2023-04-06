import { Controller, Get } from '@nestjs/common';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { UserSettingService } from './user-setting.service';

@Controller()
export class UserSettingController {
    constructor(private readonly userSettingService: UserSettingService) {}

    @Get()
    async fetchUserSetting(userId: number): Promise<UserSetting> {
        return this.userSettingService.fetchUserSetting(userId);
    }
}
