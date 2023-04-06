import { Body, Controller, Get, Header, Param, Put } from '@nestjs/common';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { UpdateUserSettingRequestDto } from '@dto/users/update-user-setting-request.dto';
import { UserSettingService } from './user-setting.service';

@Controller()
export class UserSettingController {
    constructor(private readonly userSettingService: UserSettingService) {}

    @Get()
    async fetchUserSetting(userId: number): Promise<UserSetting> {
        return this.userSettingService.fetchUserSetting(userId);
    }

    @Put(':id(\\d)')
    @Header('Content-type', 'application/json')
    async updateUserSetting(
        @Param('id') id: string,
        @Body() updateUserSettingDto: UpdateUserSettingRequestDto
    ): Promise<boolean> {
        return await this.userSettingService.updateUserSetting(+id, updateUserSettingDto);
    }
}
