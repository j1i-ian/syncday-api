import { Body, Controller, Get, Header, Patch, Put } from '@nestjs/common';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { UpdateUserSettingRequestDto } from '@dto/users/update-user-setting-request.dto';
import { AuthUser } from '../../../decorators/auth-user.decorator';
import { AppJwtPayload } from '../../../auth/strategy/jwt/app-jwt-payload.interface';
import { PatchUserSettingRequestDto } from '../../../dto/users/user-settings/update-user-workspace-request.dto';
import { UserSettingService } from './user-setting.service';

@Controller()
export class UserSettingController {
    constructor(private readonly userSettingService: UserSettingService) {}

    @Get()
    async fetchUserSetting(@AuthUser() { id: userId }: AppJwtPayload): Promise<UserSetting> {
        return this.userSettingService.fetchUserSetting(userId);
    }

    @Patch(':userId(\\d+)')
    @Header('Content-type', 'application/json')
    async updateWorkspace(
        @Body() putUserSettingRequestDto: PatchUserSettingRequestDto,
        @AuthUser() { id }: AppJwtPayload
    ): Promise<boolean> {
        const { workspace } = putUserSettingRequestDto;
        const workspaceStatus = await this.userSettingService.createUserWorkspaceStatus(
            id,
            workspace
        );

        return workspaceStatus;
    }

    @Put(':userId(\\d+)')
    @Header('Content-type', 'application/json')
    async updateUserSetting(
        @AuthUser() { id: userId }: AppJwtPayload,
        @Body() updateUserSettingDto: UpdateUserSettingRequestDto
    ): Promise<boolean> {
        return await this.userSettingService.updateUserSetting(+userId, updateUserSettingDto);
    }
}
