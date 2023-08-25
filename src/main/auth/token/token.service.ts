import { Inject, Injectable, InternalServerErrorException, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions, JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { calendar_v3, oauth2_v2 } from 'googleapis';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
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
        this.jwtRefreshTokenOption = AppConfigService.getJwtRefreshOptions(this.configService);
    }

    jwtOption: JwtModuleOptions;
    jwtRefreshTokenOption: JwtModuleOptions;

    generateGoogleOAuthAuthoizationUrl(
        integrationContext: IntegrationContext,
        timezone: string | null,
        accessToken: string | null
    ): string {

        const decodedUserOrNull: User | null = accessToken
            ? this.jwtService.decode(accessToken) as User
            : null;

        return this.googleIntegrationFacade.generateGoogleOAuthAuthoizationUrl(
            integrationContext,
            decodedUserOrNull,
            timezone
        );
    }

    async issueTokenByGoogleOAuth(
        authorizationCode: string,
        timezone: string,
        integrationContext: IntegrationContext,
        requestUserEmail: string | null,
        language: Language
    ): Promise<{ issuedToken: CreateTokenResponseDto; isNewbie: boolean; insufficientPermission: boolean }> {
        const { googleUser, calendars, schedules, tokens, insufficientPermission } =
            await this.googleIntegrationFacade.fetchGoogleUsersWithToken(authorizationCode, {
                onlyPrimaryCalendarSchedule: true
            });
        const googleUserEmail = googleUser.email;

        let loadedUserOrNull = await this.userService.findUserByEmail(requestUserEmail || googleUser.email);

        const newGoogleCalendarIntegrations = this.googleConverterService.convertToGoogleCalendarIntegration(calendars);

        const canBeSignUpContext = integrationContext === IntegrationContext.SIGN_UP || integrationContext === IntegrationContext.SIGN_IN;
        const isNewbie = canBeSignUpContext && loadedUserOrNull === null;
        const isSignUp = canBeSignUpContext && isNewbie;
        const isSignIn = canBeSignUpContext && !isNewbie;

        if (isSignUp) {
            const primaryGoogleCalendar = calendars?.items.find((_cal) => _cal.primary) as calendar_v3.Schema$CalendarListEntry;
            const ensuredTimezone = timezone || primaryGoogleCalendar?.timeZone as string;

            const createUserRequestDto: CreateUserRequestDto = {
                email: googleUser.email,
                name: googleUser.name,
                timezone: ensuredTimezone
            };

            loadedUserOrNull = await this.userService.createUserByGoogleOAuth2(
                createUserRequestDto,
                tokens,
                newGoogleCalendarIntegrations,
                {
                    googleUserEmail,
                    calendars,
                    schedules
                },
                language
            );
        } else if (isSignIn) {

            const ensuredUser = loadedUserOrNull as User;
            const hasUserGoogleIntegration =
            ensuredUser.googleIntergrations &&
            ensuredUser.googleIntergrations.length > 0;

            // TODO: This logic cannot support multiple google integrations. After collecting google integration, we should update this block.
            // old user but has no google integration
            if (hasUserGoogleIntegration === false) {

                await this.googleIntegrationService.create(ensuredUser, ensuredUser.userSetting, tokens, newGoogleCalendarIntegrations, {
                    googleUserEmail,
                    calendars,
                    schedules
                });
            }
        } else if (integrationContext === IntegrationContext.INTEGRATE) {
            // when integrationContext is integrationContext.Integrate
            const ensuredUser = loadedUserOrNull as User;

            const alreadyIntegrated = ensuredUser.googleIntergrations.find((_integration) => _integration.email === googleUser.email);

            if (!alreadyIntegrated) {
                await this.googleIntegrationService.create(
                    ensuredUser,
                    ensuredUser.userSetting,
                    tokens,
                    newGoogleCalendarIntegrations,
                    {
                        googleUserEmail,
                        calendars,
                        schedules
                    }
                );
            }
        } else {
            throw new InternalServerErrorException('Unknown integration context');
        }

        const issuedToken = this.issueToken(loadedUserOrNull as User);
        return { issuedToken, isNewbie, insufficientPermission };
    }

    issueTokenByRefreshToken(refreshToken: string): CreateTokenResponseDto {

        const decoedUserByRefreshToken: User = this.jwtService.verify(refreshToken, {
            secret: this.jwtRefreshTokenOption.secret
        });

        return this.issueToken(decoedUserByRefreshToken);
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

        const signedRefreshToken =  this.jwtService.sign(
            {
                id: user.id,
                uuid: user.uuid,
                email: user.email,
                profileImage: user.profileImage,
                name: user.name,
                userSettingId: user.userSettingId
            } as Partial<User>,
            {
                secret: this.jwtRefreshTokenOption.secret,
                expiresIn: this.jwtRefreshTokenOption.signOptions?.expiresIn
            }
        );

        return {
            accessToken: signedAccessToken,
            refreshToken: signedRefreshToken
        };
    }

    comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return compare(plainPassword, hashedPassword);
    }
}
