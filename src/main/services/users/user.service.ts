import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Availability } from '@core/entities/availability/availability.entity';
import { AvailableTime } from '@core/entities/availability/availability-time.entity';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { User } from '@entity/users/user.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { Weekday } from '@entity/availability/weekday.enum';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';
import { EmailVertificationFailException } from '@app/exceptions/users/email-verification-fail.exception';
import { TokenService } from '../../auth/token/token.service';
import { VerificationService } from '../../auth/verification/verification.service';
import { Language } from '../../enums/language.enum';
import { AlreadySignedUpEmailException } from '../../exceptions/already-signed-up-email.exception';
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
        private readonly availabilityRedisRepository: AvailabilityRedisRepository,
        @InjectRepository(User) private readonly userRepository: Repository<User>
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
                userSetting: true
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

        const canBeUsedAsWorkspace = await this.userSettingService.fetchUserWorkspaceStatus(
            emailId || newUser.name
        );
        const shouldAddRandomSuffix = canBeUsedAsWorkspace;

        const defaultUserSetting = this.utilService.getUserDefaultSetting(createdUser, language, {
            randomSuffix: shouldAddRandomSuffix
        });

        const userSetting = newUser.userSetting ?? defaultUserSetting;

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
            name: 'default',
            link: 'default'
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
        initialAvailability.timezone = userSetting?.preferredTimezone;

        const savedAvailability = await _availabilityRepository.save(initialAvailability);
        await this.availabilityRedisRepository.save(savedAvailability.uuid, savedUser.uuid, {
            availableTimes,
            overrides: []
        });

        initialEvent.availabilityId = savedAvailability.id;

        initialEventGroup.events = [initialEvent];
        initialEventGroup.user = savedUser;

        await manager.getRepository(EventGroup).save(initialEventGroup);

        await this.eventRedisRepository.setEventLinkSetStatus(savedUser.uuid, initialEvent.name);

        return plainToInstance(User, savedUser);
    }

    async createUserByGoogleOAuth2(
        createUserRequestDto: CreateUserRequestDto,
        googleAuthToken: OAuthToken,
        googleCalendarIntegrations: GoogleCalendarIntegration[],
        language: Language
    ): Promise<User> {
        const createdUser = await this.datasource.transaction(async (manager) => {
            const newUser = createUserRequestDto as User;

            const _googleIntegrationRepository = manager.getRepository(GoogleIntegration);

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

            await _googleIntegrationRepository.save({
                accessToken: googleAuthToken.accessToken,
                refreshToken: googleAuthToken.refreshToken,
                email: createUserRequestDto.email,
                users: [_createdUser],
                googleCalendarIntegrations: googleCalendarIntegrations.map((calendar) => {
                    calendar.users = [_createdUser];
                    return calendar;
                })
            });

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

    async updateUser(userId: number): Promise<boolean> {
        return await Promise.resolve(!!userId);
    }

    async deleteUser(userId: number): Promise<boolean> {
        return await Promise.resolve(!!userId);
    }
}
