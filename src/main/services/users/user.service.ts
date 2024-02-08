import { BadRequestException, Inject, Injectable, InternalServerErrorException, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsRelations, FindOptionsSelect, FindOptionsWhere, In, Like, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Observable, concatMap, defaultIfEmpty, defer, filter, firstValueFrom, forkJoin, from, map, mergeMap, of, tap, toArray, zip, zipWith } from 'rxjs';
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
import { Team } from '@entity/teams/team.entity';
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

    async findUserByLocalAuth(emailOrPhone: string): Promise<User | null> {

        const _appJwtPayloadFindOptionsSelect = this.appJwtPayloadFindOptionsSelect;
        const _appJwtPayloadFindOptionsRelations = this.appJwtPayloadFindOptionsRelations;

        const emailFindOptionWhere = emailOrPhone.includes('@')
            ? { email: emailOrPhone }
            : { phone: emailOrPhone };

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
        emailOrPhoneNumber: string,
        requestPlainPassword: string
    ): Promise<User | null> {
        const loadedUser = await this.findUserByLocalAuth(emailOrPhoneNumber);

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
                this._createUser(
                    transactionManager,
                    newUser,
                    profileName,
                    temporaryUser.language,
                    timezone,
                    {
                        plainPassword: temporaryUser.plainPassword,
                        emailVerification: true
                    }
                ).pipe(
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
                firstValueFrom(this._createUser(
                    transactionManager,
                    newUser,
                    name,
                    language,
                    timezone,
                    {
                        plainPassword,
                        alreadySignedUpUserCheckByPhone: true
                    }
                ).pipe(
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

    _createUser(
        manager: EntityManager,
        newUser: User,
        profileName: string,
        language: Language,
        timezone: string,
        {
            plainPassword,
            emailVerification,
            alreadySignedUpUserCheck,
            alreadySignedUpUserCheckByPhone
        }: CreateUserOptions = {
            plainPassword: undefined,
            emailVerification: false,
            alreadySignedUpUserCheck: true,
            alreadySignedUpUserCheckByPhone: false
        }
    ): Observable<CreatedUserTeamProfile> {

        const emailVerification$ = of(!!emailVerification)
            .pipe(
                filter((_emailVerification) => _emailVerification),
                mergeMap(() => defer(() => from(this.verificationService.isVerifiedUser(newUser.email as string)))),
                map((isVerifiedEmail) => {
                    if (isVerifiedEmail === false) {
                        throw new BadRequestException('Verification is not completed');
                    }
                }),
                tap(() => {

                    this.logger.info({
                        message: 'Email validation is passed'
                    });
                }),
                defaultIfEmpty(true)
            );

        const alreadySignedUpUserCheck$ = of(!!alreadySignedUpUserCheck)
            .pipe(
                filter((_alreadySignedUpUserCheck) => _alreadySignedUpUserCheck),
                mergeMap(() => defer(() => from(this.findUserByLocalAuth(newUser.email as string)))),
                map((foundUser) => {
                    const isEmailSearched = !!foundUser;

                    if (isEmailSearched) {
                        throw new AlreadySignedUpEmailException('Already signed up email.');
                    }
                }),
                tap(() => {
                    this.logger.info({
                        message: 'Local auth validation is passed'
                    });
                }),
                defaultIfEmpty(true)
            );

        const alreadySignedUpUserCheckByPhone$ = of(!!alreadySignedUpUserCheckByPhone)
            .pipe(
                filter((_alreadySignedUpUserCheckByPhone) => _alreadySignedUpUserCheckByPhone),
                mergeMap(() => defer(() => from(this.search({ phone: newUser.phone as string })))),
                map((searchedUsers) => {
                    const isPhoneNumberSearched = searchedUsers.length > 0;

                    if (isPhoneNumberSearched) {
                        throw new AlreadySignedUpPhoneException('Already signed up phone.');
                    }
                }),
                tap(() => {
                    this.logger.info({
                        message: 'Phone validation is passed'
                    });
                }),
                defaultIfEmpty(true)
            );

        const validations$ = zip([
            emailVerification$,
            alreadySignedUpUserCheck$,
            alreadySignedUpUserCheckByPhone$
        ]);

        const createdUser$ = of(this.userRepository.create(newUser));

        const workspace$ = createdUser$
            .pipe(
                tap((_createdUser) => {
                    this.logger.info({
                        message: 'Patch workspace',
                        email: _createdUser.email,
                        phone: _createdUser.phone
                    });
                }),
                map((_createdUser) => _createdUser.email?.replaceAll('.', '').split('@').shift() || profileName)
            );

        const shouldAddRandomSuffix$ = workspace$.pipe(
            mergeMap((_workspace) => defer(() => from(this.teamSettingService.fetchTeamWorkspaceStatus(_workspace))))
        );

        const defaultTeamWorkspace$ = zip(workspace$, createdUser$, shouldAddRandomSuffix$)
            .pipe(
                map(([workspace, _createdUser, shouldAddRandomSuffix]) => this.utilService.getDefaultTeamWorkspace(
                    workspace,
                    _createdUser.email,
                    _createdUser.phone,
                    {
                        randomSuffix: shouldAddRandomSuffix
                    })
                ),
                tap((_defaultTeamWorkspace) => {

                    this.logger.info({
                        message: 'Trying to create new team ..',
                        defaultTeamWorkspace: _defaultTeamWorkspace
                    });
                })
            );

        const savedTeam$ = defaultTeamWorkspace$.pipe(
            mergeMap((_defaultTeamWorkspace) => defer(() => from(this.teamService._create(
                manager,
                { name: profileName },
                { workspace: _defaultTeamWorkspace }
            )))),
            tap(() => {
                this.logger.info({
                    message: 'creating new team is completed successfully. Trying to create a user',
                    profileName
                });
            })
        );

        const _userSetting$ = of(this.utilService.getUserDefaultSetting(language, { timezone }) as UserSetting);

        const savedUser$ = forkJoin({
            _createdUser: createdUser$,
            _userSetting: _userSetting$,
            _userRepository: of(manager.getRepository(User)),
            _hashedPassword: of(plainPassword ? this.utilService.hash(plainPassword) : null)
        }).pipe(
            mergeMap(({
                _createdUser,
                _userSetting: userSetting,
                _userRepository: userRepository,
                _hashedPassword: hashedPassword
            }) => defer(() => from(userRepository.save({
                ..._createdUser,
                hashedPassword,
                userSetting
            } as User))))
        );

        const savedProfile$: Observable<Profile> = forkJoin({
            savedTeam: savedTeam$,
            savedUser: savedUser$
        }).pipe(
            tap(({ savedTeam, savedUser }) => {

                this.logger.info({
                    message: 'creating new user with team is completed successfully. Trying to create a profile',
                    profileName,
                    savedTeamId: savedTeam.id,
                    savedUserId: savedUser.id
                });
            }),
            mergeMap(({ savedTeam, savedUser }) =>
                defer(() => from(this.profilesService._create(
                    manager,
                    {
                        name: profileName,
                        default: true,
                        status: ProfileStatus.ACTIVATED,
                        roles: [Role.OWNER],
                        teamId: savedTeam.id,
                        userId: savedUser.id
                    }
                )) as Observable<Profile>)
            ),
            tap(() => {
                this.logger.info({
                    message: 'creating new profile is completed successfully',
                    profileName
                });
            })
        );

        const savedAvailability$ = _userSetting$.pipe(
            map((_userSetting) => this.utilService.getDefaultAvailability(
                _userSetting.preferredLanguage,
                _userSetting.preferredTimezone
            )),
            zipWith(savedTeam$, savedProfile$),
            mergeMap(([defaultAvailability, savedTeam, savedProfile]) => defer(() => from(this.availabilityService._create(
                manager,
                savedTeam.uuid,
                savedProfile.id,
                defaultAvailability,
                {
                    default: true
                }
            )))),
            tap(() => {
                this.logger.info({
                    message: 'Creating the default availability is done. Trying to create a event types'
                });
            })
        );

        const savedEventGroup$ = forkJoin({
            initialEventGroup: savedTeam$.pipe(map((_savedTeam) => {
                const _initialEventGroup = new EventGroup();
                _initialEventGroup.teamId = _savedTeam.id;

                return _initialEventGroup;
            })),
            eventGroupRepository: of(manager.getRepository(EventGroup))
        }).pipe(
            mergeMap(({ eventGroupRepository, initialEventGroup }) =>
                defer(() => from(eventGroupRepository.save(initialEventGroup)))
            )
        );

        const initialEvent$ = savedUser$
            .pipe(
                map((_savedUser) => !_savedUser.email),
                zipWith(savedEventGroup$),
                map(([ hasNoEmailUser, savedEventGroup ]) => this.utilService.getDefaultEvent({
                    name: '30 Minute Meeting',
                    link: '30-minute-meeting',
                    eventGroupId: savedEventGroup.id,
                    hasNoEmailUser
                }))
            );

        const savedEvent$ = zip([
            savedTeam$,
            savedProfile$,
            savedAvailability$,
            initialEvent$
        ]).pipe(
            mergeMap(([savedTeam, savedProfile, savedAvailability, initialEvent]) =>
                defer(() => from(this.eventsService._create(
                    manager,
                    savedTeam.uuid,
                    savedProfile.id,
                    savedAvailability.id,
                    initialEvent
                )))
            )
        );

        return validations$
            .pipe(
                mergeMap(() => savedEvent$),
                mergeMap(() => forkJoin({
                    createdUser: savedUser$.pipe(map((savedUser) => plainToInstance(User, savedUser))),
                    createdTeam: savedTeam$.pipe(map((savedTeam) => plainToInstance(Team, savedTeam))),
                    createdProfile: savedProfile$
                })),
                tap(({ createdTeam, createdProfile }) => {
                    this.logger.info({
                        message: 'All creating for sign up is completed successfully',
                        savedTeamUUID: createdTeam.uuid,
                        savedProfileId: createdProfile.id
                    });
                })
            );
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

        this.logger.info({
            message: 'Start transaction for creating a user with oauth2',
            oauth2UserEmail
        });

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
            } = await firstValueFrom(this._createUser(
                manager,
                newUser,
                newProfileName,
                language,
                timezone,
                {
                    plainPassword: undefined,
                    alreadySignedUpUserCheck: false,
                    emailVerification: false
                }
            ));

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
                preferredTimezone: true
            }
        };
    }
}
