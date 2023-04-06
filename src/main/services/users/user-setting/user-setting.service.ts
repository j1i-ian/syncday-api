import { Repository } from 'typeorm';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { SyncdayRedisService } from '../../syncday-redis/syncday-redis.service';

@Injectable()
export class UserSettingService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @InjectRepository(UserSetting)
        private readonly userSettingRepository: Repository<UserSetting>
    ) {}

    async fetchUserWorkspaceStatus(workspace: string): Promise<boolean> {
        const workspaceStatus = await this.syncdayRedisService.getWorkspaceStatus(workspace);
        return workspaceStatus;
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
        const previousWorkspace = loadedUserSetting.link;

        await this.syncdayRedisService.deleteWorkspaceStatus(previousWorkspace);

        const workspaceStatus = await this.syncdayRedisService.setWorkspaceStatus(newWorkspace);

        await this.userSettingRepository.update({ userId }, { link: newWorkspace });

        return workspaceStatus;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async fetchUserSetting(userId: number): Promise<UserSetting> {
        return Promise.resolve({} as UserSetting);
    }

    async updateUserSetting(
        userId: number,
        newUserSetting: Partial<UserSetting>
    ): Promise<boolean> {
        const updateResult = await this.userSettingRepository.update(
            { userId },
            { ...newUserSetting }
        );

        return updateResult.affected ? updateResult.affected > 0 : false;
    }
}
