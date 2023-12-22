import { BadRequestException, Inject, Injectable, InternalServerErrorException, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Observable, firstValueFrom, from, map, mergeMap, of } from 'rxjs';
import { Availability } from '@core/entities/availability/availability.entity';
import { AvailableTime } from '@core/entities/availability/availability-time.entity';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { OAuth2AccountUserProfileMetaInfo } from '@core/interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { Role } from '@interfaces/profiles/role.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { CreatedUserTeamProfile } from '@services/users/created-user-team-profile.interface';
import { ProfilesService } from '@services/profiles/profiles.service';
import { TeamService } from '@services/team/team.service';
import { InvitedNewTeamMember } from '@services/team/invited-new-team-member.type';
import { OAuth2MetaInfo } from '@services/users/oauth2-metainfo.interface';
import { OAuth2TokenServiceLocator } from '@services/oauth2/oauth2-token.service-locator';
import { OAuth2UserProfile } from '@services/users/oauth2-user-profile.interface';
import { AvailabilityService } from '@services/availability/availability.service';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { EventsService } from '@services/events/events.service';
import { User } from '@entity/users/user.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { EventGroup } from '@entity/events/event-group.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { Event } from '@entity/events/event.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { Team } from '@entity/teams/team.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { UpdateUserPasswordsVO } from '@dto/users/update-user-password.vo';
import { UpdatePhoneWithVerificationDto } from '@dto/verifications/update-phone-with-verification.dto';
import { EmailVertificationFailException } from '@app/exceptions/users/email-verification-fail.exception';
import { PhoneVertificationFailException } from '@app/exceptions/users/phone-verification-fail.exception';
import { VerificationService } from '../../auth/verification/verification.service';
import { Language } from '../../enums/language.enum';
import { AlreadySignedUpEmailException } from '../../exceptions/already-signed-up-email.exception';
import { PasswordMismatchException } from '@exceptions/auth/password-mismatch.exception';
import { UtilService } from '../util/util.service';
import { SyncdayRedisService } from '../syncday-redis/syncday-redis.service';


interface CreateUserOptions {
    plainPassword?: string;
    emailVerification?: boolean;
    alreadySignedUpUserCheck?: boolean;
}

@Injectable()
export class UserService {
    constructor(
        private readonly oauth2TokenServiceLocator: OAuth2TokenServiceLocator,
        private readonly timeUtilService: TimeUtilService,
        private readonly utilService: UtilService,
        private readonly syncdayRedisService: SyncdayRedisService,
        private readonly oauth2AccountService: OAuth2AccountsService,
        private readonly profilesService: ProfilesService,
        private readonly teamSettingService: TeamSettingService,
        private readonly availabilityService: AvailabilityService,
        private readonly notificationsService: NotificationsService,
        private readonly googleIntegrationService: GoogleIntegrationsService,
        @Inject(forwardRef(() => VerificationService))
        private readonly verificationService: VerificationService,
        @Inject(forwardRef(() => TeamService))
        private readonly teamService: TeamService,
        private readonly eventsService: EventsService,
        private readonly eventRedisRepository: EventsRedisRepository,
        private readonly availabilityRedisRepository: AvailabilityRedisRepository,
        @InjectDataSource() private datasource: DataSource,
        @InjectRepository(User) private readonly userRepository: Repository<User>
    ) {}

    async searchByEmailOrPhone(users: InvitedNewTeamMember[]): Promise<User[]> {

        const emails = users
            .filter((_user) => _user.email)
            .map((_user) => _user.email);

        const phones = users
            .filter((_user) => _user.phone)
            .map((_user) => _user.phone);

        const loadedUsers = await this.userRepository.findBy(
            [
                { email: In(emails) },
                { phone: In(phones) }
            ]
        );

        return loadedUsers;
    }

    async findUserById(userId: number): Promise<User> {
        const loadedUser = await this.userRepository.findOneOrFail({
            where: {
                id: userId
            },
            relations: {
                userSetting: true
            }
        });

        return loadedUser;
    }

    async findUserByEmail(email: string): Promise<User | null> {
        const loadedUser = await this.userRepository.findOne({
            relations: {
                profiles: {
                    googleIntergrations: true,
                    zoomIntegrations: true,
                    team: {
                        teamSetting: true
                    }
                },
                userSetting: true,
                oauth2Accounts: true
            },
            select: {
                id: true,
                uuid: true,
                email: true,
                hashedPassword: true,
                profiles: {
                    uuid: true,
                    id: true,
                    name: true,
                    roles: true,
                    team: {
                        id: true,
                        uuid: true
                    }
                },
                userSetting: {
                    id: true,
                    preferredTimezone: true
                }
            },
            where: {
                email,
                profiles: {
                    default: true
                }
            }
        });

        return loadedUser;
    }

    async validateEmailAndPassword(
        email: string,
        requestPlainPassword: string
    ): Promise<User | null> {
        const loadedUser = await this.findUserByEmail(email);

        let result = false;
        if (loadedUser) {
            result = await this.utilService.comparePassword(
                requestPlainPassword,
                loadedUser.hashedPassword
            );
        } else {
            result = false;
        }

        return result ? loadedUser : null;
    }

    createUser(
        integrationVendor: IntegrationVendor,
        oauth2UserProfile: OAuth2AccountUserProfileMetaInfo,
        timezone: string,
        language: Language
    ): Observable<CreatedUserTeamProfile>;
    createUser(
        email: string,
        verificationCode: string,
        timezone: string
    ): Observable<CreatedUserTeamProfile>;
    createUser(
        emailOrIntegrationVendor: string | IntegrationVendor,
        verificationCodeOrOAuth2UserProfile: string | OAuth2AccountUserProfileMetaInfo,
        timezone: string,
        language?: Language
    ): Observable<CreatedUserTeamProfile> {

        const isOAuth2SignUp = !!language;

        const createUser$ = isOAuth2SignUp === false ?
            from(
                this._createUserWithVerificationByEmail(
                    emailOrIntegrationVendor,
                    verificationCodeOrOAuth2UserProfile as string,
                    timezone
                )
            ) :
            of(this.oauth2TokenServiceLocator.get(emailOrIntegrationVendor as IntegrationVendor))
                .pipe(
                    map((oauth2TokenService) =>
                        oauth2TokenService.converter.convertToCreateUserRequestDTO(
                            timezone,
                            verificationCodeOrOAuth2UserProfile as OAuth2AccountUserProfileMetaInfo
                        )
                    ),
                    mergeMap(({
                        oauth2Type,
                        createUserRequestDto,
                        oauth2Token,
                        oauth2UserProfile,
                        integrationParams
                    }) =>
                        this.createUserWithOAuth2(
                            oauth2Type,
                            createUserRequestDto,
                            oauth2Token,
                            oauth2UserProfile,
                            language as Language,
                            integrationParams
                        )
                    )
                );

        return createUser$;
    }

    async _createUserWithVerificationByEmail(
        email: string,
        verificationCode: string,
        timezone: string
    ): Promise<CreatedUserTeamProfile> {
        const verificationOrNull = await this.syncdayRedisService.getEmailVerification(email);

        const isCodeMatched =
            verificationOrNull !== null && verificationOrNull.verificationCode === verificationCode;

        if (!isCodeMatched) {
            throw new EmailVertificationFailException();
        }

        await this.syncdayRedisService.setEmailVerificationStatus(
            email,
            verificationOrNull.uuid
        );

        const temporaryUser = await this.syncdayRedisService.getTemporaryUser(email);
        const profileName = temporaryUser.name;
        const newUser = this.userRepository.create(temporaryUser);

        const {
            createdProfile,
            createdUser,
            createdTeam
        } = await this.datasource.transaction(async (transactionManager) => {

            const _createdUserAndTeam = await this._createUser(transactionManager, newUser, profileName, temporaryUser.language, timezone, {
                plainPassword: temporaryUser.plainPassword,
                emailVerification: true
            });

            return _createdUserAndTeam;
        });

        const createdProfileByInvitations = await firstValueFrom(
            this.profilesService.createInvitedProfiles(createdUser).pipe(
                mergeMap((_profiles) => this.profilesService.completeInvitation(createdUser)
                    .pipe(map(() => _profiles))
                )
            )
        );

        createdUser.profiles = [ createdProfile ].concat(createdProfileByInvitations);

        await this.notificationsService.sendWelcomeEmailForNewUser(
            createdProfile.name,
            createdUser.email,
            createdUser.userSetting.preferredLanguage
        );

        return {
            createdUser,
            createdProfile,
            createdTeam
        };
    }

    async _createUser(
        manager: EntityManager,
        newUser: User,
        profileName: string,
        language: Language,
        timezone: string,
        { plainPassword, emailVerification, alreadySignedUpUserCheck }: CreateUserOptions = {
            plainPassword: undefined,
            emailVerification: false,
            alreadySignedUpUserCheck: true
        }
    ): Promise<CreatedUserTeamProfile> {
        /**
         * TODO: it should be applied Criteria Pattern.
         */
        if (emailVerification) {
            const isVerifiedEmail = await this.verificationService.isVerifiedUser(newUser.email);

            if (isVerifiedEmail !== true) {
                throw new BadRequestException('Verification is not completed');
            }
        }

        if (alreadySignedUpUserCheck) {
            const alreadySignedUser = await this.findUserByEmail(newUser.email);

            if (alreadySignedUser) {
                throw new AlreadySignedUpEmailException('Already signed up email.');
            }
        }

        const _createdUser = this.userRepository.create(newUser);

        const defaultUserSetting = this.utilService.getUserDefaultSetting(language, {
            timezone
        }) as UserSetting;

        const userSetting = defaultUserSetting;

        const hashedPassword = plainPassword && this.utilService.hash(plainPassword);

        const _userRepository = manager.getRepository(User);

        const emailId = _createdUser.email.replaceAll('.', '').split('@').shift();
        const workspace = emailId || profileName;

        const alreadyUsedIn = await this.teamSettingService.fetchTeamWorkspaceStatus(
            workspace
        );
        const shouldAddRandomSuffix = alreadyUsedIn;

        const defaultTeamWorkspace = this.utilService.getDefaultTeamWorkspace(
            null,
            _createdUser.email,
            profileName,
            {
                randomSuffix: shouldAddRandomSuffix
            }
        );

        const savedTeam = await this.teamService._create(
            manager,
            { name: profileName },
            { workspace: defaultTeamWorkspace }
        );

        const savedUser = await _userRepository.save({
            ..._createdUser,
            hashedPassword,
            userSetting
        });

        const savedProfile = await this.profilesService._create(
            manager,
            {
                name: profileName,
                default: true,
                roles: [Role.OWNER],
                teamId: savedTeam.id,
                userId: savedUser.id
            }
        ) as Profile;

        const defaultAvailableTimes: AvailableTime[] = this.timeUtilService.getDefaultAvailableTimes();

        const availabilityDefaultName = this.utilService.getDefaultAvailabilityName(language);

        const savedAvailability = await this.availabilityService._create(
            manager,
            savedTeam.uuid,
            savedProfile.id,
            {
                availableTimes: defaultAvailableTimes,
                name: availabilityDefaultName,
                overrides: [],
                timezone: userSetting.preferredTimezone
            },
            {
                default: true
            }
        );

        const initialEvent = this.utilService.getDefaultEvent({
            name: '30 Minute Meeting',
            link: '30-minute-meeting'
        });
        initialEvent.availabilityId = savedAvailability.id;

        const savedEvent = await this.eventsService._create(
            manager,
            savedTeam.uuid,
            initialEvent
        );

        const initialEventGroup = new EventGroup();
        initialEventGroup.events = [savedEvent];
        initialEventGroup.teamId = savedTeam.id;

        const eventGroupRepository = manager.getRepository(EventGroup);
        await eventGroupRepository.save(initialEventGroup);

        const createdUser = plainToInstance(User, savedUser);
        const createdTeam = plainToInstance(Team, savedTeam);

        return {
            createdUser,
            createdProfile: savedProfile,
            createdTeam
        };
    }

    async createUserWithOAuth2(
        oauth2Type: OAuth2Type,
        createUserRequestDto: CreateUserRequestDto,
        oauth2Token: OAuthToken,
        {
            oauth2UserEmail,
            oauth2UserProfileImageUrl
        }: OAuth2UserProfile,
        language: Language,
        integrationParams?: Partial<OAuth2MetaInfo>
    ): Promise<CreatedUserTeamProfile> {

        const createdUserAndTeam = await this.datasource.transaction(async (manager) => {
            const newUserEmail = createUserRequestDto.email;
            const newUser = {
                email: newUserEmail,
                timezone: createUserRequestDto.timezone
            } as unknown as User;

            const newProfileName = createUserRequestDto.name;
            const newProfile = {
                name: newProfileName,
                image: oauth2UserProfileImageUrl ?? null
            } as Profile;

            newUser.profiles = [newProfile];

            const timezone = createUserRequestDto.timezone;

            const userSetting = this.utilService.getUserDefaultSetting(language, {
                timezone
            }) as UserSetting;

            const teamWorkspace = this.utilService.getDefaultTeamWorkspace(
                null,
                newUserEmail,
                newProfileName,
                {
                    randomSuffix: false
                }
            );
            const newTeamSetting = {
                workspace: teamWorkspace
            } as TeamSetting;

            const {
                createdUser: _createdUser,
                createdProfile: _createdProfile,
                createdTeam: _createdTeam
            } = await this._createUser(manager, newUser, newProfileName, language, timezone, {
                plainPassword: undefined,
                alreadySignedUpUserCheck: false,
                emailVerification: false
            });

            const _newOAuth2Account: OAuth2Account = {
                email: oauth2UserEmail,
                oauth2Type,
                user: _createdUser
            } as OAuth2Account;

            const _createdOAuth2Account = await this.oauth2AccountService._create(
                manager,
                _createdUser,
                _newOAuth2Account
            );

            _createdUser.oauth2Accounts = [_createdOAuth2Account];

            if (oauth2Type === OAuth2Type.GOOGLE) {

                const {
                    googleCalendarIntegrations,
                    googleIntegrationBody,
                    options
                } = integrationParams as OAuth2MetaInfo;

                const _createdGoogleIntegration = await this.googleIntegrationService._create(
                    manager,
                    _createdProfile,
                    newTeamSetting,
                    userSetting,
                    oauth2Token,
                    googleCalendarIntegrations,
                    googleIntegrationBody,
                    options
                );
                _createdProfile.googleIntergrations = [_createdGoogleIntegration];
            }

            await this.teamSettingService._updateTeamWorkspace(
                manager,
                _createdTeam.id,
                null,
                _createdTeam.teamSetting.workspace
            );

            return {
                createdUser: _createdUser,
                createdProfile: _createdProfile,
                createdTeam: _createdTeam
            } as CreatedUserTeamProfile;
        });

        return createdUserAndTeam;
    }

    async patch(userId: number, partialUser: Partial<User>): Promise<boolean> {
        const updateResult = await this.userRepository.update(userId, partialUser);

        return updateResult.affected ? updateResult.affected > 0 : false;
    }

    async updateUserPassword(userId: number, updateUserPasswords: UpdateUserPasswordsVO): Promise<boolean> {

        const hashedPassword = this.utilService.hash(updateUserPasswords.newPassword);

        const loadedUser = await this.userRepository.findOneOrFail({
            select: {
                id: true,
                uuid: true,
                email: true,
                // profileImage: true,
                hashedPassword: true
            },
            where: {
                id: userId
            }
        });

        const result = await this.utilService.comparePassword(
            updateUserPasswords.password,
            loadedUser.hashedPassword
        );

        if (result === false) {
            throw new PasswordMismatchException('password is wrong.');
        }

        const updateUser = {
            ...loadedUser,
            hashedPassword
        } as User;

        const updateResult = await this.userRepository.update(userId, updateUser);

        return updateResult.affected ? updateResult.affected > 0 : false;
    }

    async updateUserPhone(userId: number, updatePhoneWithVerificationDto: UpdatePhoneWithVerificationDto): Promise<boolean> {
        const verificationOrNull = await this.syncdayRedisService.getPhoneVerification(updatePhoneWithVerificationDto.phone);

        const isCodeMatched =
            verificationOrNull !== null && verificationOrNull.verificationCode === updatePhoneWithVerificationDto.verificationCode;

        let isUpdated = false;
        if (isCodeMatched) {
            await this.syncdayRedisService.setPhoneVerificationStatus(
                updatePhoneWithVerificationDto.phone,
                verificationOrNull.uuid
            );

            const updateResult =  await this.userRepository.update(userId, {
                phone: updatePhoneWithVerificationDto.phone
            });

            isUpdated = updateResult.affected ? updateResult.affected > 0 : false;
        } else {
            throw new PhoneVertificationFailException();
        }

        return isUpdated;
    }

    async deleteUser(userId: number): Promise<boolean> {

        const user = await this.userRepository.findOneOrFail({
            where: {
                id: userId,
                profiles: {
                    default: true
                }
            },
            relations: {
                userSetting: true,
                profiles: {
                    availabilities: true,
                    team: {
                        eventGroup: {
                            events: {
                                eventDetail: {
                                    schedules: true
                                }
                            }
                        },
                        teamSetting: true
                    },
                    googleIntergrations: true
                }
            }
        });

        const {
            profiles,
            userSetting
        } = user;
        const defaultProfile = profiles[0];
        const { availabilities } = defaultProfile;
        const { googleIntergrations, team } = defaultProfile;
        const {
            eventGroup: eventGroups,
            teamSetting
        } = team;

        const eventGroup = eventGroups.pop() as EventGroup ;

        const { events } = eventGroup;

        const { eventDetailIds, eventDetailUUIDs } = events.reduce((eventDetailIdAndEventDetailUUIDArray, event) => {
            const { eventDetailIds, eventDetailUUIDs } = eventDetailIdAndEventDetailUUIDArray;
            eventDetailIds.push(event.eventDetail.id);
            eventDetailUUIDs.push(event.eventDetail.uuid);
            return { eventDetailIds, eventDetailUUIDs };
        }, { eventDetailIds: [] as number[], eventDetailUUIDs:[] as string[] });

        const availabilityUUIDs = availabilities.map((availability) => availability.uuid);

        const googleIntergration = googleIntergrations.pop() as GoogleIntegration;

        const deleteSuccess = await this.datasource.transaction(async (transactionManager) => {

            if (googleIntergration) {
                await this.googleIntegrationService._remove(transactionManager, googleIntergration.id, userId);
            }

            const deleteEntityMapList = [
                { EntityClass: EventDetail, deleteCriteria: eventDetailIds },
                { EntityClass: Event, deleteCriteria: { eventGroupId: eventGroup.id } },
                { EntityClass: EventGroup, deleteCriteria: eventGroup.id },
                { EntityClass: Availability, deleteCriteria: { userId } },
                { EntityClass: UserSetting, deleteCriteria: userSetting.id },
                { EntityClass: User, deleteCriteria: userId }
            ];

            for (const deleteEntityMap of deleteEntityMapList) {
                const { EntityClass: _DeleteTargetEntity, deleteCriteria } = deleteEntityMap;

                const repository = transactionManager.getRepository(_DeleteTargetEntity);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
                const deleteResult = await repository.delete(deleteCriteria as unknown as any);

                const deleteSuccess = deleteResult.affected && deleteResult.affected >= 0;
                if (deleteSuccess === false) {
                    throw new InternalServerErrorException('Delete user is failed');
                }
            }

            return true;
        });

        // TODO: Transaction processing is required for event processing.
        await this.availabilityRedisRepository.deleteAll(team.uuid, availabilityUUIDs);
        await this.eventRedisRepository.removeEventDetails(eventDetailUUIDs);
        await this.syncdayRedisService.deleteWorkspaceStatus(teamSetting.workspace);

        return deleteSuccess;
    }
}
