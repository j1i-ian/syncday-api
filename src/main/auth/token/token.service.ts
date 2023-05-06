import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { oauth2_v2 } from 'googleapis';
import { User } from '@entity/users/user.entity';
import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { Language } from '@app/enums/language.enum';
import { AppConfigService } from '../../../configs/app-config.service';
import { UserService } from '../../services/users/user.service';
import { IntegrationUtilService } from '../../services/util/integration-util/integraion-util.service';

export interface EnsuredGoogleTokenResponse {
    accessToken: string;
    refreshToken: string;
}

export type EnsuredGoogleOAuth2User = oauth2_v2.Schema$Userinfo &
    EnsuredGoogleTokenResponse & {
        email: string;
        name: string;
        picture: string;
    };

@Injectable()
export class TokenService {
    constructor(
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        private readonly integrationUtilService: IntegrationUtilService
    ) {
        this.jwtOption = AppConfigService.getJwtOptions(this.configService);
    }

    jwtOption: JwtModuleOptions;

    generateGoogleOAuthAuthoizationUrl(): string {
        return this.integrationUtilService.generateGoogleOAuthAuthoizationUrl();
    }

    async issueTokenByGoogleOAuth(
        authorizationCode: string,
        language: Language
    ): Promise<{
        issuedToken: CreateTokenResponseDto;
        isNewbie: boolean;
    }> {
        const { redirectURI } = AppConfigService.getGoogleOAuth2Setting(this.configService);

        const oauthClient = this.integrationUtilService.generateGoogleOauthClient(redirectURI);
        const tokens = await this.integrationUtilService.issueGoogleTokenByAuthorizationCode(
            oauthClient,
            authorizationCode
        );

        const googleUserInfo = await this.integrationUtilService.getGoogleUserInfo(
            oauthClient,
            tokens.refreshToken
        );

        let isNewbie = false;
        let loadedUserOrNull = await this.userService.findUserByEmail(googleUserInfo.email);

        if (loadedUserOrNull === null || loadedUserOrNull === undefined) {
            const createUserRequestDto: CreateUserRequestDto = {
                email: googleUserInfo.email,
                name: googleUserInfo.name as string
            };

            loadedUserOrNull = await this.userService.createUserByGoogleOAuth2(
                createUserRequestDto,
                tokens,
                language
            );
            isNewbie = true;
        }

        const issuedToken = this.issueToken(loadedUserOrNull);
        return { issuedToken, isNewbie };
    }

    issueToken(user: User): CreateTokenResponseDto {
        const signedAccessToken = this.jwtService.sign(
            {
                id: user.id,
                uuid: user.uuid,
                email: user.email,
                profileImage: user.profileImage,
                name: user.name,
                userSettingId: user.userSettingId
            } as Partial<User>,
            {
                secret: this.jwtOption.secret,
                expiresIn: this.jwtOption.signOptions?.expiresIn
            }
        );

        const signedRefreshToken = '';

        return {
            accessToken: signedAccessToken,
            refreshToken: signedRefreshToken
        };
    }

    comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return compare(plainPassword, hashedPassword);
    }
}
