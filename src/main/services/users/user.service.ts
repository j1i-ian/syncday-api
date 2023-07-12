import { BadRequestException, Inject, Injectable, InternalServerErrorException, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Observable, from } from 'rxjs';
import { Availability } from '@core/entities/availability/availability.entity';
import { AvailableTime } from '@core/entities/availability/availability-time.entity';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { User } from '@entity/users/user.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { Weekday } from '@entity/availability/weekday.enum';
import { EventDetail } from '@entity/events/event-detail.entity';
import { Event } from '@entity/events/event.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { UpdateUserPasswordsVO } from '@dto/users/update-user-password.vo';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';
import { EmailVertificationFailException } from '@app/exceptions/users/email-verification-fail.exception';
import { GoogleIntegrationBody } from '@app/interfaces/integrations/google/google-integration-body.interface';
import { TokenService } from '../../auth/token/token.service';
import { VerificationService } from '../../auth/verification/verification.service';
import { Language } from '../../enums/language.enum';
import { AlreadySignedUpEmailException } from '../../exceptions/already-signed-up-email.exception';
import { PasswordMismatchException } from '@exceptions/auth/password-mismatch.exception';
import { UserSettingService } from './user-setting/user-setting.service';
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
        @InjectDataSource() private datasource: DataSource,
        @Inject(forwardRef(() => TokenService))
        private readonly tokenService: TokenService,
        private readonly verificationService: VerificationService,
        private readonly userSettingService: UserSettingService,
        private readonly syncdayRedisService: SyncdayRedisService,
        private readonly utilService: UtilService,
        private readonly eventRedisRepository: EventsRedisRepository,
        private readonly googleIntegrationService: GoogleIntegrationsService,
        private readonly availabilityRedisRepository: AvailabilityRedisRepository,
        @InjectRepository(User) private readonly userRepository: Repository<User>
    ) {}

    findUserByWorkspace(userWorkspace: string): Observable<User> {
        return from(
            this.userRepository.findOneOrFail({
                where: {
                    userSetting: {
                        workspace: userWorkspace
                    }
                },
                relations: ['userSetting']
            })
        );
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
                userSetting: true,
                googleIntergrations: true
            },
            select: {
                id: true,
                uuid: true,
                email: true,
                profileImage: true,
                hashedPassword: true
            },
            where: {
                email
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
            result = await this.tokenService.comparePassword(
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
        verificationCode: string
    ): Promise<User | null> {
        const verificationOrNull = await this.syncdayRedisService.getEmailVerification(email);

        const isCodeMatched =
            verificationOrNull !== null && verificationOrNull.verificationCode === verificationCode;

        let createdUser = null;

        if (isCodeMatched) {
            await this.syncdayRedisService.setEmailVerificationStatus(
                email,
                verificationOrNull.uuid
            );

            const temporaryUser = await this.syncdayRedisService.getTemporaryUser(email);
            const newUser = this.userRepository.create(temporaryUser);

            const manager = this.userRepository.manager;

            createdUser = await this._createUser(manager, newUser, temporaryUser.language, {
                plainPassword: temporaryUser.plainPassword,
                emailVerification: true
            });

            await this.userSettingService.createUserWorkspaceStatus(
                manager,
                createdUser.id,
                createdUser.userSetting.workspace
            );
        } else {
            throw new EmailVertificationFailException();
        }

        return createdUser;
    }

    async _createUser(
        manager: EntityManager,
        newUser: User,
        language: Language,
        { plainPassword, emailVerification, alreadySignedUpUserCheck }: CreateUserOptions = {
            plainPassword: undefined,
            emailVerification: false,
            alreadySignedUpUserCheck: true
        }
    ): Promise<User> {
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

        const createdUser = this.userRepository.create(newUser);

        const emailId = createdUser.email.split('@').shift();
        const workspace = emailId || newUser.name;

        const alreadyUsedIn = await this.userSettingService.fetchUserWorkspaceStatus(
            workspace
        );
        const shouldAddRandomSuffix = alreadyUsedIn;

        createdUser.userSetting = {
            ...createdUser.userSetting,
            workspace
        } as UserSetting;

        const defaultUserSetting = this.utilService.getUserDefaultSetting(createdUser, language, {
            randomSuffix: shouldAddRandomSuffix
        }) as UserSetting;

        const userSetting = defaultUserSetting;

        const hashedPassword = plainPassword && this.utilService.hash(plainPassword);

        const _userRepository = manager.getRepository(User);
        const _availabilityRepository = manager.getRepository(Availability);

        const savedUser = await _userRepository.save<User>({
            ...createdUser,
            hashedPassword,
            userSetting
        } as User);

        const initialEventGroup = new EventGroup();
        const initialEvent = this.utilService.getDefaultEvent({
            name: '30 Minute Meeting',
            link: '30 Minute Meeting'
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
        initialAvailability.user = savedUser;
        initialAvailability.timezone = userSetting.preferredTimezone;

        const savedAvailability = await _availabilityRepository.save(initialAvailability);
        await this.availabilityRedisRepository.save(savedUser.uuid, savedAvailability.uuid, {
            availableTimes,
            overrides: []
        });

        initialEvent.availabilityId = savedAvailability.id;

        initialEventGroup.events = [initialEvent];
        initialEventGroup.user = savedUser;

        const eventGroupRepository = manager.getRepository(EventGroup);

        const createdEventGroup = await eventGroupRepository.save(initialEventGroup);

        const intializedEvent = createdEventGroup.events.pop() as Event;
        const initializedEventDetail = intializedEvent.eventDetail;

        await this.eventRedisRepository.setEventLinkSetStatus(savedUser.uuid, initialEvent.name);
        await this.eventRedisRepository.save(
            initializedEventDetail.uuid,
            initializedEventDetail.inviteeQuestions,
            initializedEventDetail.notificationInfo,
            initializedEventDetail.eventSetting
        );

        return plainToInstance(User, savedUser);
    }

    async createUserByGoogleOAuth2(
        createUserRequestDto: CreateUserRequestDto,
        googleAuthToken: OAuthToken,
        googleCalendarIntegrations: GoogleCalendarIntegration[],
        googleIntegrationBody: GoogleIntegrationBody,
        language: Language
    ): Promise<User> {

        const createdUser = await this.datasource.transaction(async (manager) => {
            const newUser = createUserRequestDto as User;

            newUser.userSetting = this.utilService.getUserDefaultSetting(newUser, language, {
                randomSuffix: false,
                timezone: createUserRequestDto.timezone
            }) as UserSetting;

            const _createdUser = await this._createUser(manager, newUser, language, {
                plainPassword: undefined,
                alreadySignedUpUserCheck: false,
                emailVerification: false
            });

            _createdUser.patchPromotedPropertyFromUserSetting();

            const _createdGoogleIntegration = await this.googleIntegrationService._createGoogleIntegration(
                manager,
                _createdUser,
                googleAuthToken,
                googleCalendarIntegrations,
                googleIntegrationBody
            );

            _createdUser.googleIntergrations = [_createdGoogleIntegration];

            await this.userSettingService.createUserWorkspaceStatus(
                manager,
                _createdUser.id,
                _createdUser.userSetting.workspace
            );

            return _createdUser;
        });

        return createdUser;
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
                profileImage: true,
                hashedPassword: true
            },
            where: {
                id: userId
            }
        });

        const result = await this.tokenService.comparePassword(
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

    async deleteUser(userId: number): Promise<boolean> {

        const user = await this.userRepository.findOneOrFail({
            where: {
                id: userId
            },
            relations: {
                userSetting: true,
                eventGroup: {
                    events: {
                        eventDetail: true
                    }
                },
                availabilities: true
            }
        });

        const { eventGroup: eventGroups, userSetting, availabilities } = user;
        const eventGroup = eventGroups.pop() as EventGroup ;
        const { events } = eventGroup;
        const { eventDetailIds, eventDetailUUIDs } = events.reduce((eventDetailIdAndEventDetailUUIDArray, event) => {
            const { eventDetailIds, eventDetailUUIDs } = eventDetailIdAndEventDetailUUIDArray;
            eventDetailIds.push(event.eventDetail.id);
            eventDetailUUIDs.push(event.eventDetail.uuid);
            return { eventDetailIds, eventDetailUUIDs };
        }, { eventDetailIds: [] as number[], eventDetailUUIDs:[] as string[] });
        const availabilityUUIDs = availabilities.map((availability) => availability.uuid);

        const deleteSuccess = await this.datasource.transaction(async (transactionManager) => {

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
            // TODO: Transaction processing is required for event processing.
            await this.availabilityRedisRepository.deleteAll(user.uuid, availabilityUUIDs);
            await this.eventRedisRepository.removeEventDetails(eventDetailUUIDs);

            return true;
        });
        return deleteSuccess;
    }
}
