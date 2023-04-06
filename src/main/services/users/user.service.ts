import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { oauth2_v2 } from 'googleapis';
import { User } from '@entity/users/user.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { TokenService } from '../../auth/token/token.service';
import { CreateGoogleUserRequest } from '../../dto/users/create-google-user-request.dto';
import { UserSetting } from '../../../@core/core/entities/users/user-setting.entity';
import { GoogleIntegration } from '../../../@core/core/entities/integrations/google/google-integration.entity';
import { VerificationService } from '../../auth/verification/verification.service';
import { Language } from '../../enums/language.enum';
import { GoogleIntegrationsService } from '../integrations/google-integrations.service';

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
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        @InjectRepository(UserSetting)
        private readonly userSettingRepository: Repository<UserSetting>
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

    async createUser(newUser: CreateUserRequestDto): Promise<User> {
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

        const salt = await bcrypt.genSalt(5);
        const hashedPassword = await bcrypt.hash(newUser.plainPassword, salt);

        const savedUser = await this.userRepository.save({
            ...createdUser,
            hashedPassword
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

    async createUserSetting(userSetting: UserSetting): Promise<UserSetting> {
        const savedUserSetting = await this.userSettingRepository.save(userSetting);
        return savedUserSetting;
    }
}
