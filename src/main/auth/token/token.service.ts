import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { oauth2_v2 } from 'googleapis';
import { GoogleIntegrationFacade } from '@services/integrations/google-integration/google-integration.facade';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { User } from '@entity/users/user.entity';
import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { Language } from '@app/enums/language.enum';
import { AppConfigService } from '../../../configs/app-config.service';
import { UserService } from '../../services/users/user.service';

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
        private readonly googleIntegrationFacade: GoogleIntegrationFacade,
        private readonly googleIntegrationService: GoogleIntegrationsService,
        private readonly googleConverterService: GoogleConverterService
    ) {
        this.jwtOption = AppConfigService.getJwtOptions(this.configService);
    }

    jwtOption: JwtModuleOptions;

    generateGoogleOAuthAuthoizationUrl(): string {
        return this.googleIntegrationFacade.generateGoogleOAuthAuthoizationUrl();
    }

    async issueTokenByGoogleOAuth(
        authorizationCode: string,
        language: Language
    ): Promise<{ issuedToken: CreateTokenResponseDto; isNewbie: boolean }> {
        const { googleUser, calendars, schedules, tokens } =
            await this.googleIntegrationFacade.fetchGoogleUsersWithToken(authorizationCode, {
                onlyPrimaryCalendarSchedule: true
            });

        let loadedUserOrNull = await this.userService.findUserByEmail(googleUser.email);

        const newGoogleCalendarIntegrations = this.googleConverterService.convertToGoogleCalendarIntegration(calendars);
        let isNewbie = loadedUserOrNull === null || loadedUserOrNull === undefined;

        if (isNewbie) {
            const createUserRequestDto: CreateUserRequestDto = {
                email: googleUser.email,
                name: googleUser.name
            };

            loadedUserOrNull = await this.userService.createUserByGoogleOAuth2(
                createUserRequestDto,
                tokens,
                newGoogleCalendarIntegrations,
                {
                    calendars,
                    schedules
                },
                language
            );

            isNewbie = true;
        } else {

            const ensuredUser = loadedUserOrNull as User;
            const hasUserGoogleIntegration =
            ensuredUser.googleIntergrations &&
            ensuredUser.googleIntergrations.length > 0;

            // TODO: This logic cannot support multiple google integrations. After collecting google integration, we should update this block.
            // old user but has no google integration
            if (hasUserGoogleIntegration === false) {
                await this.googleIntegrationService.create(ensuredUser, tokens, newGoogleCalendarIntegrations, {
                    calendars,
                    schedules
                });
            }
        }

        const issuedToken = this.issueToken(loadedUserOrNull as User);
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
