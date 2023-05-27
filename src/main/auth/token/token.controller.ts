import { URL } from 'url';
import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '@config/app-config.service';
import { AuthUser } from '@decorators/auth-user.decorator';
import { BCP47AcceptLanguage } from '@decorators/accept-language.decorator';
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
    issueTokenWithGoogleOAuth2(@Res() response: Response): void {
        const authorizationUrl = this.tokenService.generateGoogleOAuthAuthoizationUrl();

        response.writeHead(301, { Location: authorizationUrl });
        response.end();
    }

    @Post()
    @Public()
    @UseGuards(LocalAuthGuard)
    issueTokenByEmail(@AuthUser() user: User): CreateTokenResponseDto {
        return this.tokenService.issueToken(user);
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

        const { issuedToken, isNewbie } = await this.tokenService.issueTokenByGoogleOAuth(
            authorizationCode,
            language
        );

        const { googleOAuth2SuccessRedirectURI } = AppConfigService.getGoogleOAuth2Setting(
            this.configService
        );

        const redirectURL = new URL(googleOAuth2SuccessRedirectURI);
        redirectURL.searchParams.append('accessToken', issuedToken.accessToken);
        redirectURL.searchParams.append('refreshToken', issuedToken.refreshToken);
        redirectURL.searchParams.append('newbie', String(isNewbie));

        /**
         * TODO: url search param 대신 header 에 넣어서 전달하는 방법이 있는지 찾아봐야한다.
         */
        response.setHeader('X-Access-Token', issuedToken.accessToken);
        response.setHeader('X-Refresh-Token', issuedToken.refreshToken);

        response.redirect(redirectURL.toString());
    }
}
