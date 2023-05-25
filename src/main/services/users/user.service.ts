import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Availability } from '@core/entities/availability/availability.entity';
import { AvailableTime } from '@core/entities/availability/availability-time.entity';
import { User } from '@entity/users/user.entity';
import { BufferTime } from '@entity/events/buffer-time.entity';
import { EventType } from '@entity/events/event-type.entity';
import { TimeRange } from '@entity/events/time-range.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { Event } from '@entity/events/event.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { DateRange } from '@entity/events/date-range.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { Contact } from '@entity/events/contact.entity';
import { ContactType } from '@entity/events/contact-type.enum';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';
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
        } else {
            createdUser = null;
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

        const canBeUsedAsWorkspace = await this.userSettingService.fetchUserWorkspaceStatus(
            createdUser.email
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

        const _5min = '00:05:00';
        const initialBufferTime = new BufferTime();
        initialBufferTime.before = _5min;
        initialBufferTime.after = _5min;

        const initialTimeRange = new TimeRange();
        initialTimeRange.startTime = _5min;
        initialTimeRange.endTime = _5min;
        const initialDateRange = new DateRange();
        initialDateRange.before = 1;

        const initialContact = new Contact({
            type: ContactType.OFFLINE,
            value: 'meeting room'
        });

        const initialEventDetail = new EventDetail({
            bufferTime: initialBufferTime,
            timeRange: initialTimeRange,
            dateRange: initialDateRange,
            contacts: [initialContact],
            description: 'default'
        });

        const initialEventGroup = new EventGroup();
        const initialEvent = new Event({
            type: EventType.ONE_ON_ONE,
            link: 'default',
            name: 'default',
            eventDetail: initialEventDetail
        });

        // 월 ~ 금, 09:00 ~ 17:00
        const availableTimes = [];
        for (let dayWeekIndex = 0; dayWeekIndex < 5; dayWeekIndex++) {
            const initialAvailableTime = new AvailableTime();
            initialAvailableTime.day = dayWeekIndex;
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
        await this.syncdayRedisService.setAvailability(savedAvailability.uuid, savedUser.uuid, {
            availableTimes,
            overrides: []
        });
        initialEvent.availabilityId = savedAvailability.id;

        initialEvent.eventDetail = initialEventDetail;
        initialEventGroup.events = [initialEvent];
        initialEventGroup.user = savedUser;

        await manager.getRepository(EventGroup).save(initialEventGroup);

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
