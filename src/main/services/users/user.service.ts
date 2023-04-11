import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
    forwardRef
} from '@nestjs/common';
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
import { EnsuredGoogleOAuth2User, TokenService } from '../../auth/token/token.service';
import { VerificationService } from '../../auth/verification/verification.service';
import { Language } from '../../enums/language.enum';
import { UpdateUserSettingRequestDto } from '../../dto/users/update-user-setting-request.dto';
import { AlreadySignedUpEmailException } from '../../exceptions/already-signed-up-email.exception';
import { FetchUserInfoResponseDto } from '../../dto/users/fetch-user-info-response.dto';
import { EventDetail } from '../../../@core/core/entities/events/event-detail.entity';
import { GoogleIntegrationsService } from '../integrations/google-integrations.service';
import { UserSettingService } from './user-setting/user-setting.service';
import { UtilService } from '../util/util.service';
import { SyncdayRedisService } from '../syncday-redis/syncday-redis.service';
import { IntegrationsInfo } from './interfaces/integrations-info.interface';

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
        const loadedUser = await this.userRepository.findOneBy({ email });

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

    async updateVerificationByEmail(email: string, verificationCode: string): Promise<boolean> {
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

        const initialEventGroup = new EventGroup();
        const initialEvent = new Event({
            type: EventType.ONE_ON_ONE,
            link: 'default',
            name: 'default'
        });

        const initialEventDetail = new EventDetail({
            bufferTime: initialBufferTime,
            timeRange: initialTimeRange
        });

        initialEvent.eventDetail = initialEventDetail;
        initialEventGroup.events = [initialEvent];

        await manager.getRepository(EventGroup).save(initialEventGroup);

        return savedUser;
    }

    async createUserForGoogle(
        googleUser: EnsuredGoogleOAuth2User,
        timezone: string
    ): Promise<User> {
        const newUser = this.userRepository.create({
            email: googleUser.email,
            nickname: googleUser.name,
            profileImage: googleUser.picture
        });

        const createdUser = this.datasource.transaction(async (manager) => {
            const savedGoogleIntegration =
                await this.googleIntegrationService.saveGoogleIntegrationForGoogleUser(
                    manager,
                    googleUser
                );
            newUser.googleIntergrations = [savedGoogleIntegration];

            newUser.userSetting = this.utilService.getUsetDefaultSetting(
                { email: googleUser.email },
                googleUser.locale as Language,
                { randomSuffix: false, timezone }
            ) as UserSetting;

            const _createdUser = await this._createUser(
                manager,
                newUser,
                googleUser.locale as Language,
                {
                    plainPassword: undefined,
                    alreadySignedUpUserCheck: false,
                    emailVerification: false
                }
            );
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
        } as UserSetting);

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

    async fetchIsIntegrations(userId: number): Promise<IntegrationsInfo> {
        const loadedUserWithIntegrations = await this.userRepository.findOne({
            where: { id: userId },
            relations: { googleIntergrations: true }
        });
        if (loadedUserWithIntegrations === null) {
            throw new NotFoundException('User does not exist');
        }

        const { googleIntergrations } = loadedUserWithIntegrations;
        const isIntegrations: IntegrationsInfo = {
            google: googleIntergrations.length > 0
        };

        return isIntegrations;
    }
}
