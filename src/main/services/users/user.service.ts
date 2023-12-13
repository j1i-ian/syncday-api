import { BadRequestException, Inject, Injectable, InternalServerErrorException, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Availability } from '@core/entities/availability/availability.entity';
import { AvailableTime } from '@core/entities/availability/availability-time.entity';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { GoogleIntegrationBody } from '@core/interfaces/integrations/google/google-integration-body.interface';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { TeamSettingService } from '@services/team/team-setting/team-setting.service';
import { CreatedUserAndTeam } from '@services/users/created-user-and-team.interface';
import { User } from '@entity/users/user.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { EventGroup } from '@entity/events/event-group.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { Weekday } from '@entity/availability/weekday.enum';
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
import { CalendarCreateOption } from '@app/interfaces/integrations/calendar-create-option.interface';
import { VerificationService } from '../../auth/verification/verification.service';
import { Language } from '../../enums/language.enum';
import { AlreadySignedUpEmailException } from '../../exceptions/already-signed-up-email.exception';
import { PasswordMismatchException } from '@exceptions/auth/password-mismatch.exception';
import { UtilService } from '../util/util.service';
import { SyncdayRedisService } from '../syncday-redis/syncday-redis.service';

interface OAuth2MetaInfo {
    googleCalendarIntegrations: GoogleCalendarIntegration[];
    googleIntegrationBody: GoogleIntegrationBody;
    options: CalendarCreateOption;
}

interface CreateUserOptions {
    plainPassword?: string;
    emailVerification?: boolean;
    alreadySignedUpUserCheck?: boolean;
}

@Injectable()
export class UserService {
    constructor(
        @InjectDataSource() private datasource: DataSource,
        @Inject(forwardRef(() => VerificationService))
        private readonly verificationService: VerificationService,
        private readonly teamSettingService: TeamSettingService,
        private readonly syncdayRedisService: SyncdayRedisService,
        private readonly utilService: UtilService,
        private readonly notificationsService: NotificationsService,
        private readonly eventRedisRepository: EventsRedisRepository,
        private readonly googleIntegrationService: GoogleIntegrationsService,
        private readonly oauth2AccountService: OAuth2AccountsService,
        private readonly availabilityRedisRepository: AvailabilityRedisRepository,
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        @InjectRepository(Profile) private readonly profileRepository: Repository<Profile>,
        @InjectRepository(Team) private readonly teamRepository: Repository<Team>
    ) {}

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

    async createUserWithVerificationByEmail(
        email: string,
        verificationCode: string,
        timezone: string
    ): Promise<User | null> {
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
        const newUser = this.userRepository.create(temporaryUser);
        const newProfile = this.profileRepository.create(temporaryUser);

        const {
            createdProfile,
            createdUser
        } = await this.datasource.transaction(async (transactionManager) => {

            const _createdUserAndTeam = await this._createUser(transactionManager, newUser, newProfile, temporaryUser.language, timezone, {
                plainPassword: temporaryUser.plainPassword,
                emailVerification: true
            });

            const { createdTeam } = _createdUserAndTeam;

            await this.teamSettingService._updateTeamWorkspace(
                transactionManager,
                createdTeam.id,
                createdTeam.teamSetting.workspace
            );

            return _createdUserAndTeam;
        });

        await this.notificationsService.sendWelcomeEmailForNewUser(
            createdProfile.name,
            createdUser.email,
            createdUser.userSetting.preferredLanguage
        );

        return createdUser;
    }

    async _createUser(
        manager: EntityManager,
        newUser: User,
        newProfile: Profile,
        language: Language,
        timezone: string,
        { plainPassword, emailVerification, alreadySignedUpUserCheck }: CreateUserOptions = {
            plainPassword: undefined,
            emailVerification: false,
            alreadySignedUpUserCheck: true
        }
    ): Promise<CreatedUserAndTeam> {
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
        const _createdProfile = this.profileRepository.create(newProfile);
        _createdProfile.default = true;

        const _createdTeam = this.teamRepository.create({
            name: _createdProfile.name
        });

        const defaultUserSetting = this.utilService.getUserDefaultSetting(language, {
            timezone
        }) as UserSetting;

        const userSetting = defaultUserSetting;

        const hashedPassword = plainPassword && this.utilService.hash(plainPassword);

        const _userRepository = manager.getRepository(User);
        const _profileRepository = manager.getRepository(Profile);
        const _teamRepository = manager.getRepository(Team);
        const _availabilityRepository = manager.getRepository(Availability);

        const emailId = _createdUser.email.replaceAll('.', '').split('@').shift();
        const workspace = emailId || _createdProfile.name;

        const alreadyUsedIn = await this.teamSettingService.fetchTeamWorkspaceStatus(
            workspace
        );
        const shouldAddRandomSuffix = alreadyUsedIn;

        const defaultTeamWorkspace = this.utilService.getDefaultTeamWorkspace(
            _createdTeam,
            _createdUser,
            _createdProfile,
            {
                randomSuffix: shouldAddRandomSuffix
            }
        );

        const initialTeamSetting = new TeamSetting();
        initialTeamSetting.workspace = defaultTeamWorkspace;

        const savedUser = await _userRepository.save<User>({
            ..._createdUser,
            hashedPassword,
            userSetting
        } as User);

        const savedTeam = await _teamRepository.save<Team>({
            name: _createdProfile.name,
            teamSetting: initialTeamSetting
        } as Team);

        const savedProfile = await _profileRepository.save<Profile>({
            ..._createdProfile,
            userId: savedUser.id,
            teamId: savedTeam.id
        } as Profile);

        const initialEventGroup = new EventGroup();
        const initialEvent = this.utilService.getDefaultEvent({
            name: '30 Minute Meeting',
            link: '30-minute-meeting'
        });

        const availableTimes: AvailableTime[] = [];

        for (let weekdayIndex = Weekday.MONDAY; weekdayIndex <= Weekday.FRIDAY; weekdayIndex++) {
            const initialAvailableTime = new AvailableTime();
            initialAvailableTime.day = weekdayIndex;
            initialAvailableTime.timeRanges = [
                {
                    startTime: '09:00:00',
                    endTime: '17:00:00'
                }
            ];

            availableTimes.push(initialAvailableTime);
        }

        const initialAvailability = new Availability();
        initialAvailability.default = true;
        initialAvailability.name = this.utilService.getDefaultAvailabilityName(language);
        initialAvailability.profileId = savedProfile.id;
        initialAvailability.timezone = userSetting.preferredTimezone;

        const savedAvailability = await _availabilityRepository.save(initialAvailability);
        await this.availabilityRedisRepository.save(
            savedTeam.uuid,
            savedProfile.id,
            savedAvailability.uuid,
            {
                availableTimes,
                overrides: []
            }
        );

        initialEvent.availabilityId = savedAvailability.id;

        initialEventGroup.events = [initialEvent];
        initialEventGroup.teamId = savedTeam.id;

        const eventGroupRepository = manager.getRepository(EventGroup);

        const createdEventGroup = await eventGroupRepository.save(initialEventGroup);

        const intializedEvent = createdEventGroup.events.pop() as Event;
        const initializedEventDetail = intializedEvent.eventDetail;

        await this.eventRedisRepository.setEventLinkSetStatus(savedUser.uuid, initialEvent.link);
        await this.eventRedisRepository.save(
            initializedEventDetail.uuid,
            initializedEventDetail.inviteeQuestions,
            initializedEventDetail.notificationInfo,
            initializedEventDetail.eventSetting
        );

        const createdUser = plainToInstance(User, savedUser);
        const createdProfile = plainToInstance(Profile, savedProfile);
        const createdTeam = plainToInstance(Team, savedTeam);

        return {
            createdUser,
            createdProfile,
            createdTeam
        };
    }

    async createUserByOAuth2(
        oauth2Type: OAuth2Type,
        createUserRequestDto: CreateUserRequestDto,
        oauth2Token: OAuthToken,
        {
            oauth2UserEmail,
            oauth2UserProfileImageUrl
        }: {
            oauth2UserEmail: string;
            oauth2UserProfileImageUrl?: string | null;
        },
        language: Language,
        integrationParams?: Partial<OAuth2MetaInfo>
    ): Promise<CreatedUserAndTeam> {

        const createdUserAndTeam = await this.datasource.transaction(async (manager) => {
            const newUser = {
                email: createUserRequestDto.email,
                timezone: createUserRequestDto.timezone
            } as unknown as User;

            const newProfile = {
                name: createUserRequestDto.name,
                image: oauth2UserProfileImageUrl ?? null
            } as Profile;

            const newTeam = {
                name: createUserRequestDto.name
            } as Team;

            newUser.profiles = [newProfile];

            const timezone = createUserRequestDto.timezone;

            const userSetting = this.utilService.getUserDefaultSetting(language, {
                timezone
            }) as UserSetting;

            const teamWorkspace = this.utilService.getDefaultTeamWorkspace(
                newTeam,
                newUser,
                newProfile,
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
            } = await this._createUser(manager, newUser, newProfile, language, timezone, {
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
                _createdTeam.teamSetting.workspace
            );

            return {
                createdUser: _createdUser,
                createdProfile: _createdProfile,
                createdTeam: _createdTeam
            } as CreatedUserAndTeam;
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

    async updateUser(userId: number): Promise<boolean> {
        return await Promise.resolve(!!userId);
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
