import { Repository } from 'typeorm';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { SyncdayRedisService } from '../../syncday-redis/syncday-redis.service';
import { PatchUserSettingRequestDto } from '@share/@dto/users/user-settings/patch-user-setting-request.dto';

@Injectable()
export class UserSettingService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @InjectRepository(UserSetting)
        private readonly userSettingRepository: Repository<UserSetting>
    ) {}

    async fetchUserSettingByUserId(userId: number): Promise<UserSetting> {
        const loadedUserSetting = await this.userSettingRepository.findOneByOrFail({ userId });

        if (loadedUserSetting === null) {
            throw new NotFoundException('User settings do not exist');
        }

        return loadedUserSetting;
    }

    async patchUserSettingByUserId(
        userId: number,
        patchUserSettingRequestDto: PatchUserSettingRequestDto
    ): Promise<boolean> {
        const updateResult = await this.userSettingRepository.update(
            { userId },
            patchUserSettingRequestDto as Partial<UserSetting>
        );

        return updateResult.affected ? updateResult.affected > 0 : false;
    }

    async createUserWorkspaceStatus(userId: number, newWorkspace: string): Promise<boolean> {
        // for validation again
        const _workspaceUsageStatus = await this.syncdayRedisService.getWorkspaceStatus(
            newWorkspace
        );

        if (_workspaceUsageStatus === true) {
            throw new BadRequestException('already used workspace');
        }

        const loadedUserSetting = await this.userSettingRepository.findOneByOrFail({
            userId
        });
        const previousWorkspace = loadedUserSetting.workspace;

        await this.syncdayRedisService.deleteWorkspaceStatus(previousWorkspace);

        const workspaceStatus = await this.syncdayRedisService.setWorkspaceStatus(newWorkspace);

        await this.userSettingRepository.update({ userId }, { workspace: newWorkspace });

        return workspaceStatus;
    }

    async updateUserSetting(
        userId: number,
        newUserSetting: Partial<UserSetting>
    ): Promise<boolean> {
        const updateResult = await this.userSettingRepository.update({ userId }, newUserSetting);

        return updateResult.affected ? updateResult.affected > 0 : false;
    }

    async fetchUserWorkspaceStatus(workspace: string): Promise<boolean> {
        const workspaceStatus = await this.syncdayRedisService.getWorkspaceStatus(workspace);
        return workspaceStatus;
    }
}
