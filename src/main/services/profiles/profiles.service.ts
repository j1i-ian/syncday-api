import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsRelations, FindOptionsSelect, Repository } from 'typeorm';
import { Observable, combineLatest, defer, from, map, mergeMap, tap, toArray, zip } from 'rxjs';
import { SearchByProfileOption } from '@interfaces/profiles/search-by-profile-option.interface';
import { Role } from '@interfaces/profiles/role.enum';
import { ProfilesRedisRepository } from '@services/profiles/profiles.redis-repository';
import { InvitedNewTeamMember } from '@services/team/invited-new-team-member.type';
import { Profile } from '@entity/profiles/profile.entity';
import { User } from '@entity/users/user.entity';

@Injectable()
export class ProfilesService {

    constructor(
        private readonly profilesRedisRepository: ProfilesRedisRepository,
        @InjectDataSource() private datasource: DataSource,
        @InjectRepository(Profile) private readonly profileRepository: Repository<Profile>
    ) {}

    searchByTeamId(teamId: number): Observable<Profile[]> {
        return from(this.profileRepository.find({
            where: {
                teamId
            }
        }));
    }

    searchByUserId(
        userId: number,
        {
            withUserData
        }: Partial<SearchByProfileOption>
    ): Observable<Profile[]> {

        let relations: FindOptionsRelations<Profile> = [] as FindOptionsRelations<Profile>;
        let select: FindOptionsSelect<Profile> = {};

        if (withUserData) {
            relations = ['user'] as FindOptionsRelations<Profile>;
            select = {
                user: {
                    email: true,
                    phone: true
                }
            };
        }

        return from(this.profileRepository.find({
            select,
            relations,
            where: {
                userId
            }
        }));
    }

    findProfile(searchByProfileOption: Partial<SearchByProfileOption>): Observable<Profile> {

        const {
            profileId,
            teamId,
            userId
        } = searchByProfileOption;

        return from(this.profileRepository.findOneOrFail({
            relations: [
                'user',
                'user.oauth2Accounts',
                'team',
                'googleIntergrations',
                'appleCalDAVIntegrations',
                'zoomIntegrations'
            ],
            where: {
                id: profileId,
                teamId,
                userId
            }
        }));
    }

    createInvitedProfiles(
        user: Pick<User, 'id' | 'email' | 'phone'>
    ): Observable<Profile[]> {

        return zip(
            this.profilesRedisRepository.getInvitedTeamIds(user.email),
            this.profilesRedisRepository.getInvitedTeamIds(user.phone)
        ).pipe(
            mergeMap(([_emailTeamIds, _phoneTeamIds]) => from(_emailTeamIds.concat(_phoneTeamIds))),
            map((_teamId) => (this.profileRepository.create({
                teamId: _teamId,
                userId: user.id
            }))),
            toArray(),
            mergeMap((_newProfiles) => from(this.profileRepository.save(_newProfiles)))
        );
    }

    async _create(
        transactionManager: EntityManager,
        newProfile: Partial<Profile> | Array<Partial<Profile>>
    ): Promise<Profile | Profile[]> {
        const profileRepository = transactionManager.getRepository(Profile);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
        const createdProfile = profileRepository.create(newProfile as any);

        const savedProfile = await profileRepository.save(createdProfile);

        return savedProfile;
    }

    saveInvitedNewTeamMember(
        createdTeamId: number,
        invitedNewMembers: InvitedNewTeamMember[]
    ): Observable<boolean> {
        return this.profilesRedisRepository.setInvitedNewTeamMembers(
            createdTeamId,
            invitedNewMembers
        );
    }

    patch(profileId: number, partialProfile: Partial<Profile>): Observable<boolean> {
        return from(
            this.profileRepository.update(
                { id: profileId },
                partialProfile
            )
        ).pipe(
            map((updateResult) => !!(updateResult &&
                updateResult.affected &&
                updateResult.affected > 0))
        );
    }

    patchAll(userId: number, partialProfile: Partial<Profile>): Observable<boolean> {
        return from(
            this.profileRepository.update(
                { userId },
                partialProfile
            )
        ).pipe(
            map((updateResult) => !!(updateResult &&
                updateResult.affected &&
                updateResult.affected > 0))
        );
    }

    updateRoles(
        teamId: number,
        profileId: number,
        roles: Role[],
        targetProfileId: number,
        updateRoles: Role[]
    ): Observable<boolean> {

        return from(this.profileRepository.findOneByOrFail({
            id: targetProfileId,
            teamId
        })).pipe(
            tap((_loadedTargetProfile) => {

                const isTargetOwner = _loadedTargetProfile.roles.includes(Role.OWNER);
                const isOwnerPermissionRequest = isTargetOwner || updateRoles.includes(Role.OWNER);
                const hasNoOwnerPermission = roles.includes(Role.OWNER) === false;
                const hasNoPermission = isOwnerPermissionRequest && hasNoOwnerPermission;

                if (hasNoPermission) {
                    throw new ForbiddenException('Permission denied');
                }
            }),
            mergeMap(() => {

                const grantOwner$ = from(defer(() => this.datasource.transaction(async (manager) => {
                    const _profileRepository = manager.getRepository(Profile);


                    const __grantOwnerUpdateResult = await _profileRepository.update(
                        { id: targetProfileId },
                        {
                            roles: _updateRoles
                        }
                    );
                    const __isGrantOwnerUpdateSuccess = !!(__grantOwnerUpdateResult &&
                        __grantOwnerUpdateResult.affected &&
                        __grantOwnerUpdateResult.affected > 0);

                    const __demotePreviousOwnerUpdateResult = await _profileRepository.update(
                        { id: profileId },
                        {
                            roles: [Role.MANAGER]
                        }
                    );
                    const __isDemotePreviousOwnerUpdateSuccess = !!(__demotePreviousOwnerUpdateResult &&
                        __demotePreviousOwnerUpdateResult.affected &&
                        __demotePreviousOwnerUpdateResult.affected > 0);

                    return __isGrantOwnerUpdateSuccess && __isDemotePreviousOwnerUpdateSuccess;
                })));

                const simpleUpdate$ = from(defer(() => this.profileRepository.update(
                    { id: targetProfileId },
                    {
                        roles: _updateRoles
                    }
                ))).pipe(
                    map((updateResult) => !!(updateResult &&
                        updateResult.affected &&
                        updateResult.affected > 0)
                    )
                );

                let _updateRoles: Role[] = [];
                let typeormUpdateRoles$: Observable<boolean>;

                if (updateRoles.includes(Role.OWNER)) {
                    _updateRoles = [Role.MEMBER, Role.MANAGER, Role.OWNER];

                    typeormUpdateRoles$ = grantOwner$;
                } else if (updateRoles.includes(Role.MANAGER)) {
                    _updateRoles = [Role.MEMBER, Role.MANAGER];

                    typeormUpdateRoles$ = simpleUpdate$;
                } else {
                    _updateRoles = [Role.MEMBER];

                    typeormUpdateRoles$ = simpleUpdate$;
                }

                return typeormUpdateRoles$;
            })
        );
    }

    completeInvitation(
        user: Pick<User, 'id' | 'email' | 'phone'>
    ): Observable<boolean> {
        return combineLatest([
            this.profilesRedisRepository.deleteTeamInvitations(user.email),
            this.profilesRedisRepository.deleteTeamInvitations(user.phone)
        ]).pipe(map(() => true));
    }
}
