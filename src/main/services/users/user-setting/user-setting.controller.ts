import { Body, Controller, Get, Header, HttpCode, HttpStatus, Patch, Query } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { AuthUser } from '@decorators/auth-user.decorator';
import { FetchUserSettingResponseDto } from '@dto/users/user-settings/fetch-user-setting-response.dto';
import { PatchUserSettingRequestDto } from '@share/@dto/users/user-settings/patch-user-setting-request.dto';
import { UserSettingSearchOption } from '@share/@interfaces/users/user-settings/user-setting-search-option.interface';
import { UserSettingService } from './user-setting.service';

/**
 * User Setting is created when user signed up.
 * So there is no api for creating.
 */
@Controller()
export class UserSettingController {
    constructor(private readonly userSettingService: UserSettingService) {}

    @Get()
    @Header('Content-type', 'application/json')
    searchUserSettings(@Query('workspace') workspace?: string): Observable<boolean> {
        return this.userSettingService
            .searchUserSettings({
                workspace
            } as UserSettingSearchOption)
            .pipe(map((searchedUserSettings) => searchedUserSettings.length > 0));
    }

    @Get(':userSettingId(\\d+)')
    async fetchUserSettingByUserId(
        @AuthUser('id') userId: number
    ): Promise<FetchUserSettingResponseDto> {
        const loadedUserSetting = await this.userSettingService.fetchUserSettingByUserId(userId);
        return plainToInstance(FetchUserSettingResponseDto, loadedUserSetting, {
            excludeExtraneousValues: true
        });
    }

    @Patch(':userSettingId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async patchUserSetting(
        @AuthUser('id') userId: number,
        @Body() patchUserSettingRequestDto: PatchUserSettingRequestDto
    ): Promise<void> {
        await this.userSettingService.patchUserSettingByUserId(userId, patchUserSettingRequestDto);
    }
}
