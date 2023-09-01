import { URL } from 'url';
import { Body, Controller, Get, ParseEnumPipe, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '@config/app-config.service';
import { AuthUser } from '@decorators/auth-user.decorator';
import { BCP47AcceptLanguage } from '@decorators/accept-language.decorator';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { User } from '@entity/users/user.entity';
import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';
import { Language } from '@app/enums/language.enum';
import { Public } from '../strategy/jwt/public.decorator';
import { LocalAuthGuard } from '../strategy/local/local-auth.guard';
import { TokenService } from './token.service';

@Controller()
export class TokenController {
    constructor(
        private readonly tokenService: TokenService,
        private readonly configService: ConfigService
    ) {}

    /**
     * Token is issued from google, so this action should be treated as POST action originally.
     * But it seems to enforce direct move by security reaons like CSP,
     *
     * Client would be redirected to Google OAuth2 Server by Passport with 302 Found
     *
     * @param createTemporaryUserWithGoogleRequestDto
     * @param language
     * @returns {void}
     * @see /users/google/callback
     */
    @Get('google')
    @Public()
    issueTokenWithGoogleOAuth2(
        @Query('integrationContext', new ParseEnumPipe(IntegrationContext)) integrationContext: IntegrationContext,
        @Query('timezone') timezone: string | null = null,
        @Query('Authorization') accessToken: string | null = null,
        @Res() response: Response
    ): void {

        const authorizationUrl = this.tokenService.generateGoogleOAuthAuthoizationUrl(
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
    issueTokenByEmail(@AuthUser() user: User): CreateTokenResponseDto {
        return this.tokenService.issueToken(user);
    }

    @Put()
    @Public()
    issueTokenByRefreshToken(@Body('refreshToken') refreshToken: string): CreateTokenResponseDto {
        return this.tokenService.issueTokenByRefreshToken(refreshToken);
    }

    /**
     * Google Callback api. Authorization code is attached as query param in request.
     */
    @Get('google/callback')
    @Public()
    async googleOAuthCallback(
        @Req() request: Request,
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

        const { issuedToken, isNewbie, insufficientPermission } = await this.tokenService.issueTokenByGoogleOAuth(
            authorizationCode,
            stateParams.timezone,
            stateParams.integrationContext,
            stateParams.requestUserEmail,
            language
        );

        const { googleOAuth2SuccessRedirectURI } = AppConfigService.getGoogleOAuth2Setting(
            this.configService
        );

        const redirectURL = new URL(googleOAuth2SuccessRedirectURI);
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
