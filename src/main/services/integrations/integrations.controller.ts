import { URL } from 'url';
import { BadRequestException, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '@config/app-config.service';
import { AuthUser } from '@decorators/auth-user.decorator';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { UserService } from '@services/users/user.service';
import { Integration } from '@entity/integrations/integration.entity';
import { User } from '@entity/users/user.entity';
import { FetchZoomMeetingIntegrationResponse } from '@dto/integrations/zoom/fetch-zoom-meeting-integration-response.dto';
import { Public } from '@app/auth/strategy/jwt/public.decorator';
import { ValidateQueryParamPipe } from '@app/pipes/validate-query-param/validate-query-param.pipe';
/**
 * Sign up with Google API is located on token controller.
 */
@Controller(':vendor')
export class IntegrationsController {
    constructor(
        private readonly integrationsServiceLocator: IntegrationsServiceLocator,
        private readonly userService: UserService,
        private readonly jwtService: JwtService
    ) {}

    @Get('redirect')
    @Public()
    redirectForOAuth2(
        @Query('authorization', ValidateQueryParamPipe) syncdayAccessToken: string,
        @Param('vendor') vendor: 'google' | 'zoom',
        @Res() response: Response
    ): void {

        const integrationService = this.integrationsServiceLocator.getService(vendor);
        const redriectURI = integrationService.generateOAuth2RedirectURI(syncdayAccessToken);

        response.writeHead(301, { Location: redriectURI });
        response.end();
    }

    @Get('callback')
    @Public()
    async callbackForOAuth2(
        @Query('code') authorizationCode: string,
        @Param('vendor') vendor: 'google' | 'zoom',
        @Res() request: Request,
        @Res() response: Response
    ): Promise<void> {

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const redirectedOriginalUrl = (request as any).req.originalUrl as string;

        const host = AppConfigService.getHost();
        const baseUrl = `${request.protocol}://${host}`;
        const url = new URL(redirectedOriginalUrl, baseUrl);
        const encodedJsonStringifiedStateParams = url.searchParams.get('state') as string;

        const jsonStringifiedStateParams = encodedJsonStringifiedStateParams;

        const stateParams = JSON.parse(jsonStringifiedStateParams) as {
            accessToken: string;
        };

        const decodedUser = this.jwtService.decode(stateParams.accessToken) as User;

        const integrationService = this.integrationsServiceLocator.getService(vendor);
        const integrationFacacde = this.integrationsServiceLocator.getFacade(vendor);

        const issuedToken = await integrationFacacde.issueToken(authorizationCode);

        const loadedOAuth2User = await integrationFacacde.fetchOAuth2User(issuedToken);

        const loadedAppUserByEmail = await this.userService.findUserByEmail(decodedUser.email);

        if (!loadedAppUserByEmail) {
            throw new BadRequestException('Invalid user request - email: ' + decodedUser.email);
        }

        await integrationService.create(
            loadedAppUserByEmail,
            issuedToken,
            loadedOAuth2User
        );

        const oauth2SuccessRedirectURI = integrationFacacde.getOAuth2SuccessRedirectURI();

        const redirectURL = new URL(oauth2SuccessRedirectURI);

        response.redirect(redirectURL.toString());
    }

    @Get()
    searchIntegrations(
        @AuthUser('id') userId: number,
        @Param('vendor') vendor: 'google' | 'zoom',
        @Query('withCalendarIntegrations') withCalendarIntegrations: string | boolean
    ): Promise<Array<Integration | FetchZoomMeetingIntegrationResponse>> {

        withCalendarIntegrations = withCalendarIntegrations === 'true';

        const integrationService = this.integrationsServiceLocator.getService(vendor);

        return integrationService.search({
            userId,
            withCalendarIntegrations
        });
    }

    @Delete(':vendorIntegrationId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @AuthUser('id') userId: number,
        @Param('vendor') vendor: 'google' | 'zoom',
        @Param('vendorIntegrationId', ParseIntPipe) vendorIntegrationId: number
    ): Promise<void> {
        const integrationService = this.integrationsServiceLocator.getService(vendor);
        await integrationService.remove(vendorIntegrationId, userId);
    }
}
