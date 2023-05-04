import { Body, Controller, Get, Header, HttpCode, HttpStatus, Patch, Put } from '@nestjs/common';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { AuthUser } from '@decorators/auth-user.decorator';
import { UpdateUserSettingRequestDto } from '@dto/users/update-user-setting-request.dto';
import { PatchUserSettingRequestDto } from '@share/@dto/users/user-settings/patch-user-setting-request.dto';
import { UserSettingService } from './user-setting.service';

/**
 * User Setting is created when user signed up.
 * So there is no api for creating.
 */
@Controller()
export class UserSettingController {
    constructor(private readonly userSettingService: UserSettingService) {}

    @Get(':userSettingId(\\d+)')
    fetchUserSettingByUserId(@AuthUser('id') userId: number): Promise<UserSetting> {
        return this.userSettingService.fetchUserSettingByUserId(userId);
    }

    @Patch(':userSettingId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async patchUserSetting(
        @AuthUser('id') userId: number,
        @Body() patchUserSettingRequestDto: PatchUserSettingRequestDto
    ): Promise<void> {
        await this.userSettingService.patchUserSettingByUserId(userId, patchUserSettingRequestDto);
    }

    @Put(':userSettingId(\\d+)')
    @Header('Content-type', 'application/json')
    async updateUserSetting(
        @AuthUser('id') userId: number,
        @Body() updateUserSettingRequestDto: UpdateUserSettingRequestDto
    ): Promise<boolean> {
        return await this.userSettingService.updateUserSetting(userId, updateUserSettingRequestDto);
    }
}
