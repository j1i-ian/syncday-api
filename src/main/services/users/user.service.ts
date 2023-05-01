import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { User } from '@entity/users/user.entity';
import { BufferTime } from '@entity/events/buffer-time.entity';
import { EventType } from '@entity/events/event-type.entity';
import { TimeRange } from '@entity/events/time-range.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { Event } from '@entity/events/event.entity';
import { TimePreset } from '@entity/datetime-presets/time-preset.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { DateRange } from '@entity/events/date-range.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { DatetimePreset } from '@entity/datetime-presets/datetime-preset.entity';
import { Contact } from '@entity/events/contact.entity';
import { ContactType } from '@entity/events/contact-type.enum';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { OAuthInfo } from '@app/interfaces/auth/oauth-info.interface';
import { TokenService } from '../../auth/token/token.service';
import { VerificationService } from '../../auth/verification/verification.service';
import { Language } from '../../enums/language.enum';
import { UpdateUserSettingRequestDto } from '../../dto/users/update-user-setting-request.dto';
import { AlreadySignedUpEmailException } from '../../exceptions/already-signed-up-email.exception';
import { FetchUserInfoResponseDto } from '../../dto/users/fetch-user-info-response.dto';
import { GoogleIntegrationsService } from '../integrations/google-integrations.service';
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
        private readonly googleIntegrationService: GoogleIntegrationsService,
        private readonly verificationService: VerificationService,
        private readonly userSettingService: UserSettingService,
        private readonly syncdayRedisService: SyncdayRedisService,
        private readonly utilService: UtilService,
        @InjectRepository(User) private readonly userRepository: Repository<User>
    ) {}

    async findUserById(userId: number): Promise<User> {
        const loadedUser = await this.userRepository.findOneByOrFail({ id: userId });

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
    ): Promise<boolean> {
        const verificationOrNull = await this.syncdayRedisService.getEmailVerification(email);

        const isCodeMatched =
            verificationOrNull !== null && verificationOrNull.verificationCode === verificationCode;

        let isSuccess = false;

        if (isCodeMatched) {
            await this.syncdayRedisService.setEmailVerificationStatus(
                email,
                verificationOrNull.uuid
            );

            const temporaryUser = await this.syncdayRedisService.getTemporaryUser(email);
            const newUser = this.userRepository.create(temporaryUser);

            await this.datasource.transaction(async (manager: EntityManager) => {
                const _createdUser = await this._createUser(
                    manager,
                    newUser,
                    temporaryUser.language,
                    {
                        plainPassword: temporaryUser.plainPassword,
                        emailVerification: true
                    }
                );

                return _createdUser;
            });

            isSuccess = true;
        } else {
            isSuccess = false;
        }

        return isSuccess;
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

        const defaultUserSetting = this.utilService.getUsetDefaultSetting(createdUser, language, {
            randomSuffix: shouldAddRandomSuffix
        });

        const userSetting = newUser.userSetting ?? defaultUserSetting;

        const hashedPassword = plainPassword && this.utilService.hash(plainPassword);

        const _userRepository = manager.getRepository(User);
        const _datetimePresetRepository = manager.getRepository(DatetimePreset);

        const savedUser = await _userRepository.save({
            ...createdUser,
            hashedPassword,
            userSetting
        });

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
        const initialTimePresets = [];
        for (let dayWeekIndex = 0; dayWeekIndex < 5; dayWeekIndex++) {
            const initialTimePreset = new TimePreset();
            initialTimePreset.day = dayWeekIndex;
            initialTimePreset.timeRanges = [
                {
                    startTime: '09:00:00',
                    endTime: '17:00:00'
                }
            ];

            initialTimePresets.push(initialTimePreset);
        }

        const initialDatetimePreset = new DatetimePreset();
        initialDatetimePreset.default = true;
        initialDatetimePreset.name = this.utilService.getDefaultDatetimePresetName(language);
        initialDatetimePreset.user = savedUser;
        initialDatetimePreset.timezone = userSetting?.preferredTimezone;
        const savedDatetimePreset = await _datetimePresetRepository.save(initialDatetimePreset);
        await this.syncdayRedisService.setDatetimePreset(savedUser.uuid, savedDatetimePreset.uuid, {
            timepreset: initialTimePresets,
            overrides: []
        });
        initialEvent.datetimePresetId = savedDatetimePreset.id;

        initialEvent.eventDetail = initialEventDetail;
        initialEventGroup.events = [initialEvent];
        initialEventGroup.user = savedUser;

        await manager.getRepository(EventGroup).save(initialEventGroup);

        return savedUser;
    }

    async createUserByGoogleOAuth2(
        createUserRequestDto: CreateUserRequestDto,
        googleAuthInfo: OAuthInfo,
        language: Language
    ): Promise<User> {
        const createdUser = await this.datasource.transaction(async (manager) => {
            const newUser = createUserRequestDto as User;

            const _googleIntegrationRepository = manager.getRepository(GoogleIntegration);
            const savedGoogleIntegration = await _googleIntegrationRepository.save({
                accessToken: googleAuthInfo.accessToken,
                refreshToken: googleAuthInfo.refreshToken,
                email: createUserRequestDto.email
            });

            newUser.googleIntergrations = [savedGoogleIntegration];

            newUser.userSetting = this.utilService.getUsetDefaultSetting(newUser, language, {
                randomSuffix: false,
                timezone: createUserRequestDto.timezone
            });

            const _createdUser = await this._createUser(manager, newUser, language, {
                plainPassword: undefined,
                alreadySignedUpUserCheck: false,
                emailVerification: false
            });

            return _createdUser;
        });

        return createdUser;
    }

    async updateUser(userId: number): Promise<boolean> {
        return await Promise.resolve(!!userId);
    }

    async deleteUser(userId: number): Promise<boolean> {
        return await Promise.resolve(!!userId);
    }

    async updateUserSettingWithUserName(param: {
        userId: number;
        updateUserSetting: UpdateUserSettingRequestDto;
    }): Promise<void> {
        const { userId, updateUserSetting } = param;
        const {
            name,
            greetings,
            language: preferredLanguage,
            dateTimeFormat: preferredDateTimeFormat,
            timezone: preferredTimezone,
            dateTimeOrderFormat: preferredDateTimeOrderFormat,
            link
        } = updateUserSetting;

        const newUserSetting = new UserSetting({
            workspace: link,
            greetings,
            preferredDateTimeFormat,
            preferredDateTimeOrderFormat,
            preferredTimezone,
            preferredLanguage
        });

        if (name !== undefined) {
            await this.userRepository.update(userId, { nickname: name });
        }
        await this.userSettingService.updateUserSetting(userId, newUserSetting);
    }

    async fetchUserInfo(userId: number, email: string): Promise<FetchUserInfoResponseDto> {
        const userSetting = await this.userSettingService.fetchUserSetting(userId);
        const loadedIntegrationByUser = await this.googleIntegrationService.loadAlreadySignedUpUser(
            email
        );
        const convertedUserSettingToDto = plainToInstance(FetchUserInfoResponseDto, {
            ...userSetting,
            language: userSetting.preferredLanguage,
            dateTimeFormat: userSetting.preferredDateTimeFormat,
            dateTimeOrderFormat: userSetting.preferredDateTimeOrderFormat,
            timezone: userSetting.preferredTimezone,
            integration: {
                google: !!loadedIntegrationByUser
            }
        });

        return convertedUserSettingToDto;
    }
}
