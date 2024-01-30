import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { FetchUserSettingResponseDto } from '@dto/users/user-settings/fetch-user-setting-response.dto';
import { PatchUserSettingRequestDto } from '@dto/users/user-settings/patch-user-setting-request.dto';
import { UserSettingService } from './user-setting.service';

/**
 * User Setting is created when user signed up.
 * So there is no api for creating.
 */
@Controller()
export class UserSettingController {
    constructor(private readonly userSettingService: UserSettingService) {}

    @Get(':userSettingId(\\d+)')
    async fetchUserSettingByUserId(
        @AuthProfile('userId') userId: number
    ): Promise<FetchUserSettingResponseDto> {
        const loadedUserSetting = await this.userSettingService.fetchUserSettingByUserId(userId);
        return plainToInstance(FetchUserSettingResponseDto, loadedUserSetting, {
            excludeExtraneousValues: true
        });
    }

    @Patch(':userSettingId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async patchUserSetting(
        @AuthProfile('userId') userId: number,
        @Body() patchUserSettingRequestDto: PatchUserSettingRequestDto
    ): Promise<void> {
        await this.userSettingService.patchUserSettingByUserId(userId, patchUserSettingRequestDto);
    }
}
