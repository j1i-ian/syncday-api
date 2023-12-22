import { URL } from 'url';
import { Body, Controller, Get, Inject, Param, ParseEnumPipe, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { Observable } from 'rxjs';
import { AppConfigService } from '@config/app-config.service';
import { BCP47AcceptLanguage } from '@decorators/accept-language.decorator';
import { AuthUser } from '@decorators/auth-user.decorator';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { User } from '@entity/users/user.entity';
import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';
import { CreateTokenByRefreshTokenRequestDto } from '@dto/auth/tokens/create-token-by-refresh-token.dto';
import { Language } from '@app/enums/language.enum';
import { Public } from '../strategy/jwt/public.decorator';
import { LocalAuthGuard } from '../strategy/local/local-auth.guard';
import { TokenService } from './token.service';

@Controller()
export class TokenController {
    constructor(
        private readonly tokenService: TokenService,
        private readonly configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    /**
     * Token is issued from google, so this action should be treated as POST action originally.
     * But it seems to enforce direct move by security reaons like CSP,
     *
     * Client would be redirected to Google OAuth2 Server by Http 302 Found
     *
     * @param createTemporaryUserWithGoogleRequestDto
     * @param language
     * @returns {void}
     * @see /users/google/callback
     */
    @Get(':integrationVendor')
    @Public()
    issueTokenWithGoogleOAuth2(
        @Query('integrationContext', new ParseEnumPipe(IntegrationContext)) integrationContext: IntegrationContext,
        @Query('timezone') timezone: string | null = null,
        @Query('Authorization') accessToken: string | null = null,
        @Param('integrationVendor', new ParseEnumPipe(IntegrationVendor)) integrationVendor: IntegrationVendor,
        @Res() response: Response
    ): void {

        const authorizationUrl = this.tokenService.generateOAuth2AuthoizationUrl(
            integrationVendor,
            integrationContext,
            timezone,
            accessToken
        );

        response.writeHead(301, { Location: authorizationUrl });
        response.end();
    }

    @Post()
    @Public()
    @UseGuards(LocalAuthGuard)
    issueTokenByEmail(
        @AuthUser() authUser: User & { userSettingId: number }
    ): CreateTokenResponseDto {
        const profile = authUser.profiles[0];
        const team = profile.team;

        return this.tokenService.issueToken(
            profile,
            {
                id: authUser.id,
                email: authUser.email
            },
            {
                id: team.id,
                uuid: team.uuid
            },
            authUser.userSettingId
        );
    }

    @Put()
    @Public()
    issueTokenByRefreshToken(
        @Body() createTokenByRefreshTokenRequestDto: CreateTokenByRefreshTokenRequestDto,
        @AuthProfile('userId') userId?: number
    ): Observable<CreateTokenResponseDto> {
        return this.tokenService.issueTokenByRefreshToken(
            createTokenByRefreshTokenRequestDto.refreshToken,
            createTokenByRefreshTokenRequestDto.teamId,
            userId
        );
    }

    /**
     * Google Callback api. Authorization code is attached as query param in request.
     */
    @Get(':integrationVendor/callback')
    @Public()
    async oauth2Callback(
        @Req() request: Request,
        @Param('integrationVendor', new ParseEnumPipe(IntegrationVendor)) integrationVendor: IntegrationVendor,
        @BCP47AcceptLanguage() language: Language,
        @Res() response: Response
    ): Promise<void> {
        const baseUrl = `${request.protocol}://${request.headers.host as string}`;
        const url = new URL(request.url, baseUrl);
        const authorizationCode = url.searchParams.get('code') as string;
        const jsonStringifiedStateParams = url.searchParams.get('state') as string;
        const stateParams = JSON.parse(jsonStringifiedStateParams) as {
            timezone: string;
            requestUserEmail: string | null;
            integrationContext: IntegrationContext;
        };

        this.logger.debug({
            message: 'Start OAuth2 Callback: Start issueTokenByOAuth2',
            requestUserEmail: stateParams.requestUserEmail
        });

        const { issuedToken, isNewbie, insufficientPermission } = await this.tokenService.issueTokenByOAuth2(
            integrationVendor,
            authorizationCode,
            stateParams.timezone,
            stateParams.integrationContext,
            stateParams.requestUserEmail,
            language
        );

        this.logger.debug({
            message: 'issueTokenByOAuth2 done',
            requestUserEmail: stateParams.requestUserEmail
        });

        const { oauth2SuccessRedirectURI } = AppConfigService.getOAuth2Setting(
            integrationVendor,
            this.configService
        );

        const redirectURL = new URL(oauth2SuccessRedirectURI);
        redirectURL.searchParams.append('accessToken', issuedToken.accessToken);
        redirectURL.searchParams.append('refreshToken', issuedToken.refreshToken);
        redirectURL.searchParams.append('newbie', String(isNewbie));
        redirectURL.searchParams.append('insufficientPermission', String(insufficientPermission));

        /**
         * TODO: url search param 대신 header 에 넣어서 전달하도록 구현해야한다.
         */
        response.setHeader('X-Access-Token', issuedToken.accessToken);
        response.setHeader('X-Refresh-Token', issuedToken.refreshToken);

        response.redirect(redirectURL.toString());
    }
}
