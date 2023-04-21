import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { oauth2_v2 } from 'googleapis';
import { User } from '@entity/users/user.entity';
import { CreateTokenResponseDto } from '@dto/tokens/create-token-response.dto';
import { AppConfigService } from '../../../configs/app-config.service';
import { GoogleIntegrationsService } from '../../services/integrations/google-integrations.service';
import { UserService } from '../../services/users/user.service';
import { CreateGoogleUserRequestDto } from '../../dto/users/create-google-user-request.dto';
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
        private readonly googleIntegrationService: GoogleIntegrationsService,
        private readonly integrationUtilService: IntegrationUtilService
    ) {
        this.jwtOption = AppConfigService.getJwtOptions(this.configService);
    }

    jwtOption: JwtModuleOptions;

    async issueTokenByGoogleOAuth(
        createGoogleUserRequestDto: CreateGoogleUserRequestDto
    ): Promise<CreateTokenResponseDto> {
        const { googleAuthCode, redirectUrl, timezone } = createGoogleUserRequestDto;

        const googleUser: EnsuredGoogleOAuth2User =
            (await this.integrationUtilService.getGoogleUserInfo(
                googleAuthCode,
                redirectUrl
            )) as EnsuredGoogleOAuth2User;

        let alreadySignedUpUser = await this.googleIntegrationService.loadAlreadySignedUpUser(
            googleUser.email
        );

        if (alreadySignedUpUser === null || alreadySignedUpUser === undefined) {
            // sign up
            alreadySignedUpUser = await this.userService.createUserForGoogle(googleUser, timezone);
        }

        const createTokenResponseDto = this.issueToken(alreadySignedUpUser);
        return createTokenResponseDto;
    }

    issueToken(user: User): CreateTokenResponseDto {
        const signedAccessToken = this.jwtService.sign(
            {
                id: user.id,
                email: user.email,
                profileImage: user.profileImage,
                nickname: user.nickname
            },
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
