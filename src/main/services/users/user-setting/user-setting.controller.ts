import { Body, Controller, Get, Header, Param, Patch, Put } from '@nestjs/common';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { UpdateUserSettingRequestDto } from '@dto/users/update-user-setting-request.dto';
import { AuthUser } from '../../../decorators/auth-user.decorator';
import { AppJwtPayload } from '../../../auth/strategy/jwt/app-jwt-payload.interface';
import { UserSettingService } from './user-setting.service';

@Controller()
export class UserSettingController {
    constructor(private readonly userSettingService: UserSettingService) {}

    @Get()
    async fetchUserSetting(userId: number): Promise<UserSetting> {
        return this.userSettingService.fetchUserSetting(userId);
    }

    @Put(':id(\\d+)')
    @Header('Content-type', 'application/json')
    async updateUserSetting(
        @Param('id') id: string,
        @Body() updateUserSettingDto: UpdateUserSettingRequestDto
    ): Promise<boolean> {
        return await this.userSettingService.updateUserSetting(+id, updateUserSettingDto);
    }

    @Get(':workspace')
    @Header('Content-type', 'application/json')
    fetchWorkspaceStatus(@Param('workspace') workspace: string): Promise<boolean> {
        const workspaceStatus = this.userSettingService.fetchUserWorkspaceStatus(workspace);

        return workspaceStatus;
    }

    @Patch(':workspace')
    @Header('Content-type', 'application/json')
    async updateWorkspace(
        @Param('workspace') workspace: string,
        @AuthUser() { id }: AppJwtPayload
    ): Promise<boolean> {
        const workspaceStatus = await this.userSettingService.createUserWorkspaceStatus(
            id,
            workspace
        );

        return workspaceStatus;
    }
}
