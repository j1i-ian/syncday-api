import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { UpdateUserSettingDto } from '../../../dto/users/user-settings/dto/update-user-setting.dto';
import { UserSettingService } from './user-setting.service';

@Controller()
export class UserSettingController {
    constructor(private readonly userSettingService: UserSettingService) {}

    @Get()
    async fetchUserSetting(userId: number): Promise<UserSetting> {
        return this.userSettingService.fetchUserSetting(userId);
    }

    @Patch(':id')
    async updateUserSetting(
        @Param('id') id: string,
        @Body() updateUserSettingDto: UpdateUserSettingDto
    ): Promise<boolean> {
        return this.userSettingService.update(+id, updateUserSettingDto);
    }
}
