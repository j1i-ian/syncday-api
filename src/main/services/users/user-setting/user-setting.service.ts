import { EntityManager, Repository } from 'typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, from } from 'rxjs';
import { UserSetting } from '@core/entities/users/user-setting.entity';
import { AlreadyUsedInWorkspace } from '@app/exceptions/users/already-used-in-workspace.exception';
import { SyncdayRedisService } from '../../syncday-redis/syncday-redis.service';
import { PatchUserSettingRequestDto } from '@share/@dto/users/user-settings/patch-user-setting-request.dto';
import { UserSettingSearchOption } from '@share/@interfaces/users/user-settings/user-setting-search-option.interface';

@Injectable()
export class UserSettingService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @InjectRepository(UserSetting)
        private readonly userSettingRepository: Repository<UserSetting>
    ) {}

    searchUserSettings(
        userSettingSearchOption: UserSettingSearchOption
    ): Observable<UserSetting[]> {
        return from(this.userSettingRepository.findBy(userSettingSearchOption));
    }

    async fetchUserSettingByUserId(userId: number): Promise<UserSetting> {
        const loadedUserSetting = await this.userSettingRepository.findOneOrFail({
            relations: [
                'user',
                'user.oauth2Accounts',
                'user.googleIntergrations',
                'user.zoomIntegrations'
            ],
            where: {
                userId
            }
        });

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

    async createUserWorkspaceStatus(
        manager: EntityManager,
        userId: number,
        newWorkspace: string
    ): Promise<boolean> {

        const _userSettingRepository = manager.getRepository(UserSetting);

        // for validation again
        const _workspaceUsageStatus = await this.syncdayRedisService.getWorkspaceStatus(
            newWorkspace
        );

        if (_workspaceUsageStatus === true) {
            throw new AlreadyUsedInWorkspace();
        }

        const loadedUserSetting = await _userSettingRepository.findOneByOrFail({
            userId
        });
        const previousWorkspace = loadedUserSetting.workspace;

        // TODO: it should be wrapped by rxjs finalized.
        await this.syncdayRedisService.deleteWorkspaceStatus(previousWorkspace);

        const workspaceStatus = await this.syncdayRedisService.setWorkspaceStatus(newWorkspace);

        await _userSettingRepository.update({ userId }, { workspace: newWorkspace });

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
