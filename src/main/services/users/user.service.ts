import { BadRequestException, Inject, Injectable, InternalServerErrorException, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsRelations, FindOptionsSelect, FindOptionsWhere, In, Like, Repository } from 'typeorm';
import { Observable, concatMap, defer, firstValueFrom, from, map, mergeMap, of, tap, toArray } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Availability } from '@core/entities/availability/availability.entity';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { OAuth2AccountUserProfileMetaInfo } from '@core/interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { Role } from '@interfaces/profiles/role.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ProfileStatus } from '@interfaces/profiles/profile-status.enum';
import { UserSearchOption } from '@interfaces/users/user-search-option.interface';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { CreatedUserTeamProfile } from '@services/users/created-user-team-profile.interface';
import { ProfilesService } from '@services/profiles/profiles.service';
import { TeamService } from '@services/team/team.service';
import { OAuth2MetaInfo } from '@services/users/oauth2-metainfo.interface';
import { OAuth2TokenServiceLocator } from '@services/oauth2/oauth2-token.service-locator';
import { OAuth2UserProfile } from '@services/users/oauth2-user-profile.interface';
import { AvailabilityService } from '@services/availability/availability.service';
import { EventsService } from '@services/events/events.service';
import { User } from '@entity/users/user.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { EventGroup } from '@entity/events/event-group.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { Event } from '@entity/events/event.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { UpdateUserPasswordsVO } from '@dto/users/update-user-password.vo';
import { UpdatePhoneWithVerificationDto } from '@dto/verifications/update-phone-with-verification.dto';
import { EmailVertificationFailException } from '@app/exceptions/users/email-verification-fail.exception';
import { PhoneVertificationFailException } from '@app/exceptions/users/phone-verification-fail.exception';
import { AlreadySignedUpPhoneException } from '@app/exceptions/already-signed-up-phone.exception';
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
    alreadySignedUpUserCheckByPhone?: boolean;
    oauth2UserProfileImageUrl?: string | null;
}

@Injectable()
export class UserService {
    constructor(
        private readonly oauth2TokenServiceLocator: OAuth2TokenServiceLocator,
        private readonly utilService: UtilService,
        private readonly syncdayRedisService: SyncdayRedisService,
        private readonly oauth2AccountService: OAuth2AccountsService,
        private readonly teamSettingService: TeamSettingService,
        private readonly availabilityService: AvailabilityService,
        private readonly notificationsService: NotificationsService,
        private readonly googleIntegrationService: GoogleIntegrationsService,
        private readonly eventsService: EventsService,
        private readonly eventRedisRepository: EventsRedisRepository,
        private readonly availabilityRedisRepository: AvailabilityRedisRepository,
        @Inject(forwardRef(() => ProfilesService))
        private readonly profilesService: ProfilesService,
        @Inject(forwardRef(() => VerificationService))
        private readonly verificationService: VerificationService,
        @Inject(forwardRef(() => TeamService))
        private readonly teamService: TeamService,
        @InjectDataSource() private datasource: DataSource,
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    async search({
        email,
        emails,
        phone,
        phones
    }: Partial<UserSearchOption>): Promise<User[]> {

        const findOptions: Array<FindOptionsWhere<User>> = [];

        if (email) {
            findOptions.push({ email });
        } else if (emails) {
            findOptions.push({ email: In(emails) });
        }

        if (phone) {
            findOptions.push({ phone });
        } else if (phones) {
            findOptions.push({ phone: In(phones) });
        }

        const loadedUsers = await this.userRepository.find({
            relations: {
                userSetting: true
            },
            where: findOptions
        });

        return loadedUsers;
    }

    async findUser({
        userId,
        teamId,
        role
    }: {
        userId?: number;
        teamId?: number;
        role?: Role;
    }): Promise<User> {

        let findWhereOption: FindOptionsWhere<User> = {};

        if (userId) {
            findWhereOption = {
                id: userId
            } as FindOptionsWhere<User>;
        }

        if (teamId) {
            findWhereOption = {
                ...findWhereOption,
                team: {
                    id: teamId
                }
            } as FindOptionsWhere<User>;
        }

        if (role) {
            findWhereOption = {
                ...findWhereOption,
                profiles: {
                    roles: Like(role)
                }
            } as FindOptionsWhere<User>;
        }

        if (!userId && !teamId) {
            throw new BadRequestException('Invalid option for user finding');
        }

        const loadedUser = await this.userRepository.findOneOrFail({
            where: findWhereOption,
            relations: {
                userSetting: true
            }
        });

        return loadedUser;
    }

    async findUserByLocalAuth(user: Partial<Pick<User, 'id' | 'email' | 'phone'>>): Promise<User | null> {

        const _appJwtPayloadFindOptionsSelect = this.appJwtPayloadFindOptionsSelect;
        const _appJwtPayloadFindOptionsRelations = this.appJwtPayloadFindOptionsRelations;

        let emailFindOptionWhere: FindOptionsWhere<User> = { id: -1 };

        if (user.id) {
            emailFindOptionWhere = { id: user.id };
        } else if (user.email) {
            emailFindOptionWhere = { email: user.email };
        } else {
            emailFindOptionWhere = { phone: user.phone as string };
        }

        const loadedUser = await this.userRepository.findOne({
            relations: _appJwtPayloadFindOptionsRelations,
            select: _appJwtPayloadFindOptionsSelect,
            where: {
                ...emailFindOptionWhere
            }
        });

        return loadedUser;
    }

    async validateEmailAndPassword(
        user: Partial<Pick<User, 'id' | 'email' | 'phone'>>,
        requestPlainPassword: string
    ): Promise<User | null> {
        const loadedUser = await this.findUserByLocalAuth(user);

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
        phone: string,
        plainPassword: string,
        name: string,
        uuid: string,
        timezone: string,
        language: Language
    ): Observable<CreatedUserTeamProfile>;
    createUser(
        emailOrIntegrationVendorOrPhone: string | IntegrationVendor,
        verificationCodeOrOAuth2UserProfileOrPlainPassword: string | OAuth2AccountUserProfileMetaInfo,
        timezoneOrName: string,
        languageOrUUID?: string | Language,
        timezone?: string,
        language?: Language
    ): Observable<CreatedUserTeamProfile> {

        const isCreateUserByPhone = !!language;
        const isOAuth2SignUp = !!languageOrUUID;

        let createUser$: Observable<CreatedUserTeamProfile>;

        if (isCreateUserByPhone) {

            this.logger.info({
                message: 'Create user by phone number',
                name: timezoneOrName
            });

            createUser$ =
                this._createUserWithVerificationByPhoneNumber(
                    emailOrIntegrationVendorOrPhone,
                    verificationCodeOrOAuth2UserProfileOrPlainPassword as string,
                    timezoneOrName,
                    languageOrUUID as string,
                    timezone as string,
                    language
                );
        } else if (isOAuth2SignUp === false) {

            this.logger.info({
                message: 'Create user by email'
            });

            createUser$ = defer(() => from(
                this._createUserWithVerificationByEmail(
                    emailOrIntegrationVendorOrPhone,
                    verificationCodeOrOAuth2UserProfileOrPlainPassword as string,
                    timezoneOrName
                )
            ));
        } else {

            this.logger.info({
                message: 'Create user by oauth2'
            });

            createUser$ = of(this.oauth2TokenServiceLocator.get(emailOrIntegrationVendorOrPhone as IntegrationVendor))
                .pipe(
                    map((oauth2TokenService) =>
                        oauth2TokenService.converter.convertToCreateUserRequestDTO(
                            timezoneOrName,
                            verificationCodeOrOAuth2UserProfileOrPlainPassword as OAuth2AccountUserProfileMetaInfo
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
                            languageOrUUID as Language,
                            integrationParams
                        )
                    )
                );

        }

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

        this.logger.info({
            message: 'Email verification success',
            email
        });

        await this.syncdayRedisService.setEmailVerificationStatus(
            email,
            verificationOrNull.uuid
        );

        const temporaryUser = await this.syncdayRedisService.getTemporaryUser(email);
        const profileName = temporaryUser.name;
        const newUser = this.userRepository.create(temporaryUser);

        const defaultAvailability = this.utilService.getDefaultAvailability(
            temporaryUser.language,
            timezone
        );

        this.logger.info({
            message: 'Creating profile, team, user transaction start',
            email
        });

        const {
            createdProfile,
            createdUser,
            createdTeam
        } = await this.datasource.transaction((transactionManager) =>
            firstValueFrom(
                from(this._createUser(
                    transactionManager,
                    newUser,
                    profileName,
                    temporaryUser.language,
                    timezone,
                    {
                        plainPassword: temporaryUser.plainPassword,
                        emailVerification: true
                    }
                )).pipe(
                    tap(() => {
                        this.logger.info({
                            message: 'Creating the user is success. Start to create the profile and detect invitations',
                            email
                        });
                    }),
                    concatMap((createUserTeamProfile) =>
                        this.profilesService._createInvitedProfiles(
                            transactionManager,
                            createUserTeamProfile.createdUser,
                            defaultAvailability
                        ).pipe(
                            tap(() => {
                                this.logger.info({
                                    message: 'Creating profiles with invitations are completed. Trying to complete invitation..',
                                    email
                                });
                            }),
                            mergeMap((_profiles) => from(_profiles)),
                            mergeMap((_createdProfile) =>
                                this.profilesService.completeInvitation(
                                    _createdProfile.teamId,
                                    _createdProfile.teamUUID,
                                    createUserTeamProfile.createdUser
                                ).pipe(map(() => _createdProfile))
                            ),
                            toArray(),
                            tap(() => {
                                this.logger.info({
                                    message: 'Invitation is done',
                                    email
                                });
                            }),
                            map((createdProfilesByInvitations) => {
                                createUserTeamProfile.createdUser.profiles = [createUserTeamProfile.createdProfile].concat(createdProfilesByInvitations);
                                return createUserTeamProfile;
                            })
                        )
                    )
                )
            )
        );

        await this.notificationsService.sendWelcomeEmailForNewUser(
            createdProfile.name,
            createdUser.email as string,
            createdUser.userSetting.preferredLanguage
        );

        return {
            createdUser,
            createdProfile,
            createdTeam
        };
    }

    _createUserWithVerificationByPhoneNumber(
        phone: string,
        plainPassword: string,
        name: string,
        uuid: string,
        timezone: string,
        language: Language
    ): Observable<CreatedUserTeamProfile> {

        const isVerifiedPhoneNumber$ = defer(() => from(this.syncdayRedisService.getPhoneVerificationStatus(phone, uuid))).pipe(
            tap((isVerifiedPhoneNumber) => {
                if (!isVerifiedPhoneNumber) {
                    throw new PhoneVertificationFailException();
                }
            })
        );

        const newUser = this.userRepository.create({
            uuid,
            phone
        });

        const defaultAvailability = this.utilService.getDefaultAvailability(language, timezone);

        return isVerifiedPhoneNumber$.pipe(
            mergeMap(() => defer(() => from(this.datasource.transaction((transactionManager) =>
                firstValueFrom(from(this._createUser(
                    transactionManager,
                    newUser,
                    name,
                    language,
                    timezone,
                    {
                        plainPassword,
                        alreadySignedUpUserCheckByPhone: true
                    }
                )).pipe(
                    concatMap((createUserTeamProfile) =>
                        this.profilesService._createInvitedProfiles(
                            transactionManager,
                            createUserTeamProfile.createdUser,
                            defaultAvailability
                        )
                            .pipe(
                                mergeMap((_profiles) => from(_profiles)),
                                mergeMap((_createdProfile) => this.profilesService.completeInvitation(
                                    _createdProfile.teamId,
                                    _createdProfile.teamUUID,
                                    createUserTeamProfile.createdUser)
                                    .pipe(map(() => _createdProfile))
                                ),
                                toArray(),
                                map((createdProfilesByInvitations) => {
                                    createUserTeamProfile.createdUser.profiles = [createUserTeamProfile.createdProfile].concat(createdProfilesByInvitations);
                                    return createUserTeamProfile;
                                })
                            )
                    )
                ))
            ))
            )));
    }

    async _createUser(
        manager: EntityManager,
        newUser: User,
        profileName: string,
        language: Language,
        timezone: string,
        {
            plainPassword,
            emailVerification,
            alreadySignedUpUserCheck,
            alreadySignedUpUserCheckByPhone,
            oauth2UserProfileImageUrl
        }: CreateUserOptions = {
            plainPassword: undefined,
            emailVerification: false,
            alreadySignedUpUserCheck: true,
            alreadySignedUpUserCheckByPhone: false,
            oauth2UserProfileImageUrl: null
        }
    ): Promise<CreatedUserTeamProfile> {

        if (emailVerification) {
            const isVerifiedEmail = await this.verificationService.isVerifiedUser(newUser.email as string);

            if (isVerifiedEmail === false) {
                throw new BadRequestException('Verification is not completed');
            }

            this.logger.info({
                message: 'Email validation is passed'
            });
        }

        if (alreadySignedUpUserCheck) {
            const foundUser = await this.findUserByLocalAuth({
                email: newUser.email as string
            });
            const isEmailSearched = !!foundUser;

            if (isEmailSearched) {
                throw new AlreadySignedUpEmailException('Already signed up email.');
            }
            this.logger.info({
                message: 'Local auth validation is passed'
            });
        }

        if (alreadySignedUpUserCheckByPhone) {
            const searchedUsers = await this.search({ phone: newUser.phone as string });
            const isPhoneNumberSearched = searchedUsers.length > 0;

            if (isPhoneNumberSearched) {
                throw new AlreadySignedUpPhoneException('Already signed up phone.');
            }
            this.logger.info({
                message: 'Phone validation is passed'
            });
        }

        const _createdUser = this.userRepository.create(newUser);

        this.logger.info({
            message: 'Patch workspace',
            email: _createdUser.email,
            phone: _createdUser.phone,
            newUser
        });

        const workspace = _createdUser.email?.replaceAll('.', '').split('@').shift() || profileName;

        const shouldAddRandomSuffix = await this.teamSettingService.fetchTeamWorkspaceStatus(workspace);

        const defaultTeamWorkspace = this.utilService.getDefaultTeamWorkspace(
            workspace,
            _createdUser.email,
            _createdUser.phone,
            {
                randomSuffix:  shouldAddRandomSuffix
            }
        );

        this.logger.info({
            message: 'Trying to create new team ..',
            defaultTeamWorkspace
        });

        const savedTeam = await this.teamService._create(
            manager,
            {
                name: profileName,
                logo: oauth2UserProfileImageUrl
            },
            { workspace: defaultTeamWorkspace }
        );

        this.logger.info({
            message: 'creating new team is completed successfully. Trying to create a user',
            profileName
        });

        const userSetting = this.utilService.getUserDefaultSetting(language, { timezone }) as UserSetting;
        const userRepository = manager.getRepository(User);
        const hashedPassword = plainPassword ? this.utilService.hash(plainPassword) : null;

        const savedUser = await userRepository.save({
            ..._createdUser,
            hashedPassword,
            userSetting
        } as User);

        this.logger.info({
            message: 'creating new user with team is completed successfully. Trying to create a profile',
            profileName,
            savedTeamId: savedTeam.id,
            savedUserId: savedUser.id
        });

        const savedProfile = await this.profilesService._create(
            manager,
            {
                name: profileName,
                default: true,
                status: ProfileStatus.ACTIVATED,
                roles: [Role.OWNER],
                teamId: savedTeam.id,
                userId: savedUser.id,
                image: oauth2UserProfileImageUrl
            }
        ) as Profile;

        this.logger.info({
            message: 'creating new profile is completed successfully',
            profileName
        });

        const defaultAvailability = this.utilService.getDefaultAvailability(
            userSetting.preferredLanguage,
            userSetting.preferredTimezone
        );

        const savedAvailability = await this.availabilityService._create(
            manager,
            savedTeam.uuid,
            (savedProfile ).id,
            defaultAvailability,
            {
                default: true
            }
        );

        this.logger.info({
            message: 'Creating the default availability is done. Trying to create a event types'
        });

        const initialEventGroup = new EventGroup();
        initialEventGroup.teamId = savedTeam.id;

        const eventGroupRepository = manager.getRepository(EventGroup);

        const savedEventGroup = await eventGroupRepository.save(initialEventGroup);

        const initialEvent = this.utilService.getDefaultEvent({
            name: '30 Minute Meeting',
            link: '30-minute-meeting',
            eventGroupId: savedEventGroup.id
        }, {
            hasNoEmailUser: !savedUser.email
        });

        await this.eventsService._create(
            manager,
            savedTeam.uuid,
            savedProfile.id,
            savedAvailability.id,
            initialEvent,
            savedUser
        );

        this.logger.info({
            message: 'All creating for sign up is completed successfully',
            savedTeamUUID: savedTeam.uuid,
            savedProfileId: savedProfile.id
        });


        return {
            createdProfile: savedProfile,
            createdTeam: savedTeam,
            createdUser: savedUser
        };
    }

    async createUserWithOAuth2(
        oauth2Type: OAuth2Type,
        createUserRequestDto: CreateUserRequestDto,
        oauth2Token: OAuthToken,
        {
            oauth2UserEmail,
            oauth2UserProfileImageUrl,
            oauth2UserPhoneNumber
        }: OAuth2UserProfile,
        language: Language,
        integrationParams?: Partial<OAuth2MetaInfo>
    ): Promise<CreatedUserTeamProfile> {

        this.logger.info({
            message: 'Start transaction for creating a user with oauth2',
            oauth2UserEmail
        });

        const createdUserAndTeam = await this.datasource.transaction(async (manager) => {
            const newUserEmail = createUserRequestDto.email;
            const newUser = {
                email: newUserEmail,
                timezone: createUserRequestDto.timezone,
                image: oauth2UserProfileImageUrl,
                phone: oauth2UserPhoneNumber
            } as Partial<User> as User;

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
                newUser.phone,
                {
                    randomSuffix: false
                }
            );
            const newTeamSetting = {
                workspace: teamWorkspace
            } as TeamSetting;

            this.logger.info({
                message: 'Start to create a team and user with profile',
                newProfileName,
                teamWorkspace
            });

            const {
                createdUser: _createdUser,
                createdProfile: _createdProfile,
                createdTeam: _createdTeam
            } = await this._createUser(
                manager,
                newUser,
                newProfileName,
                language,
                timezone,
                {
                    plainPassword: undefined,
                    alreadySignedUpUserCheck: false,
                    emailVerification: false,
                    oauth2UserProfileImageUrl
                }
            );

            this.logger.info({
                message: 'Creting a team and user with profile is completed. Trying to create a oauth2 account',
                newProfileName,
                teamWorkspace,
                oauth2Type
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

                this.logger.info({
                    message: 'Creting a google integration service',
                    oauth2UserEmail,
                    teamWorkspace
                });

                const _createdGoogleIntegration = await this.googleIntegrationService._create(
                    manager,
                    _createdProfile,
                    newTeamSetting,
                    newUser,
                    userSetting,
                    oauth2Token,
                    googleCalendarIntegrations,
                    googleIntegrationBody,
                    options
                );
                _createdProfile.googleIntergrations = [_createdGoogleIntegration];

                this.logger.info({
                    message: 'Creating a Google integration is done.',
                    oauth2UserEmail,
                    teamWorkspace
                });
            }

            const defaultAvailability = this.utilService.getDefaultAvailability(
                userSetting.preferredLanguage,
                userSetting.preferredTimezone
            );

            const invitedProfiles = await firstValueFrom(this.profilesService._createInvitedProfiles(
                manager,
                _createdUser,
                defaultAvailability
            ).pipe(
                tap(() => {
                    this.logger.info({
                        message: 'Creating profiles with invitations are completed. Trying to complete invitation..',
                        email: _createdUser.email
                    });
                }),
                mergeMap((_profiles) => from(_profiles)),
                mergeMap((_createdProfile) =>
                    this.profilesService.completeInvitation(
                        _createdProfile.teamId,
                        _createdProfile.teamUUID,
                        _createdUser
                    ).pipe(map(() => _createdProfile))
                ),
                toArray(),
                tap(() => {
                    this.logger.info({
                        message: 'Invitation is done',
                        email: _createdUser.email
                    });
                }),
                map((createdProfilesByInvitations) => {
                    const _profiles = [_createdProfile].concat(createdProfilesByInvitations);
                    return _profiles;
                })
            ));

            const profiles = invitedProfiles ? [ _createdProfile ].concat(invitedProfiles) : [_createdProfile];

            _createdUser.profiles = profiles;

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

    async updateUserPhone(
        userId: number,
        userUUID: string,
        updatePhoneWithVerificationDto: UpdatePhoneWithVerificationDto
    ): Promise<boolean> {

        const isValidPhoneVerification = await this.verificationService.isValidPhoneVerification(
            updatePhoneWithVerificationDto.phone,
            updatePhoneWithVerificationDto.verificationCode,
            userUUID
        );

        let isUpdated = false;

        if (isValidPhoneVerification) {
            await this.syncdayRedisService.setPhoneVerificationStatus(
                updatePhoneWithVerificationDto.phone,
                userUUID
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
                        eventGroups: {
                            events: {
                                eventDetail: true
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
            eventGroups: eventGroups,
            teamSetting
        } = team;

        const eventGroup = eventGroups.pop() as EventGroup;

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

    get appJwtPayloadFindOptionsRelations(): FindOptionsRelations<User> {
        return {
            profiles: {
                googleIntergrations: true,
                zoomIntegrations: true,
                team: {
                    teamSetting: true
                }
            },
            userSetting: true,
            oauth2Accounts: true
        };
    }

    get appJwtPayloadFindOptionsSelect(): FindOptionsSelect<User> {
        return {
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
                preferredTimezone: true,
                preferredLanguage: true
            }
        };
    }
}
