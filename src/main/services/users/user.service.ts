import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { oauth2_v2 } from 'googleapis';
import { Repository } from 'typeorm';
import { User } from '@entity/users/user.entity';
import { TokenService } from '../../auth/token/token.service';
import { CreateGoogleUserRequest } from '../../dto/users/create-google-user-request.dto';
import { UserSetting } from '../../../@core/core/entities/users/user-setting.entity';
import { GoogleIntegration } from '../../../@core/core/entities/integrations/google/google-integration.entity';
import { VerificationService } from '../../auth/verification/verification.service';
import { Language } from '../../enums/language.enum';
import { UpdateUserSettingRequestDto } from '../../dto/users/update-user-setting-request.dto';
import { GoogleIntegrationsService } from '../integrations/google-integrations.service';
import { UserSettingService } from './user-setting/user-setting.service';
import { UtilService } from '../util/util.service';
import { SyncdayRedisService } from '../syncday-redis/syncday-redis.service';

interface EnsuredGoogleTokenResponse {
    accessToken: string;
    refreshToken: string;
}

type EnsuredGoogleOAuth2User = oauth2_v2.Schema$Userinfo & {
    email: string;
    name: string;
    picture: string;
};

@Injectable()
export class UserService {
    constructor(
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

            await this.createUser(newUser, temporaryUser.plainPassword, temporaryUser.language);

            isSuccess = true;
        } else {
            isSuccess = false;
        }

        return isSuccess;
    }

    async createUser(newUser: User, plainPassword: string, language: Language): Promise<User> {
        /**
         * TODO: it should be applied Criteria Pattern.
         */
        const isVerifiedEmail = await this.verificationService.isVerifiedUser(newUser.email);

        if (isVerifiedEmail !== true) {
            throw new BadRequestException('Verification is not completed');
        }

        const alreadySignedUser = await this.findUserByEmail(newUser.email);

        if (alreadySignedUser) {
            throw new BadRequestException('Already signed up email.');
        }

        const createdUser = this.userRepository.create(newUser);

        const canBeUsedAsWorkspace = await this.userSettingService.fetchUserWorkspaceStatus(
            createdUser.email
        );
        const shouldAddRandomSuffix = canBeUsedAsWorkspace;

        const defaultUserSetting = this.utilService.getUsetDefaultSetting(createdUser, language, {
            randomSuffix: shouldAddRandomSuffix
        });

        const salt = await bcrypt.genSalt(5);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);

        const savedUser = await this.userRepository.save({
            ...createdUser,
            hashedPassword,
            userSetting: defaultUserSetting
        });

        return savedUser;
    }

    async getOrCreateGoogleUser(param: CreateGoogleUserRequest): Promise<User> {
        const { googleAuthCode, redirectUrl, timeZone } = param;
        this.googleIntegrationService.setOauthClient(redirectUrl);

        const { accessToken, refreshToken }: EnsuredGoogleTokenResponse =
            (await this.googleIntegrationService.issueGoogleTokenByAuthorizationCode(
                googleAuthCode
            )) as EnsuredGoogleTokenResponse;
        const googleUser: EnsuredGoogleOAuth2User =
            (await this.googleIntegrationService.getGoogleUserInfo(
                refreshToken
            )) as EnsuredGoogleOAuth2User;

        let signedUser = await this.userRepository.findOne({
            where: {
                email: googleUser.email
            },
            relations: {
                googleIntergrations: true
            }
        });

        const isAlreadySignUpUserOrNoIntegrationUser =
            signedUser !== null && signedUser.googleIntergrations.length <= 0;
        if (isAlreadySignUpUserOrNoIntegrationUser) {
            /**
             * If there is a host who has already registered as an email member with the email to be linked with Google
             */
            throw new BadRequestException(
                'User who signed up with an email address other than Google.'
            );
        } else if (signedUser === null) {
            const userSetting: UserSetting = new UserSetting();
            /**
             * TODO: Apply after creating link validation util
             */
            userSetting.link = googleUser.email.split('@')[0];
            userSetting.preferredTimezone = timeZone;
            userSetting.preferredLanguage = googleUser.locale as Language;

            const googleIntegration: GoogleIntegration = new GoogleIntegration();
            googleIntegration.refreshToken = refreshToken;
            googleIntegration.accessToken = accessToken;
            googleIntegration.email = googleUser.email;
            const savedGoogleIntegration =
                await this.googleIntegrationService.saveGoogleIntegration(googleIntegration);

            const newUser = new User();
            newUser.email = googleUser.email;
            newUser.nickname = googleUser.name;
            newUser.profileImage = googleUser.picture;
            newUser.googleIntergrations = [savedGoogleIntegration];
            newUser.userSetting = userSetting;

            signedUser = await this.userRepository.save(newUser);
        }

        return signedUser;
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
            timeZone: preferredTimezone,
            dateTimeOrderFormat: preferredDateTimeOrderFormat,
            link
        } = updateUserSetting;

        const newUserSetting = new UserSetting({
            link,
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
}
