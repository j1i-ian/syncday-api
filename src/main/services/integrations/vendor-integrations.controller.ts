import { URL } from 'url';
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseIntPipe, Patch, Post, Query, Res, UseFilters } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { Observable } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AppConfigService } from '@config/app-config.service';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { UserService } from '@services/users/user.service';
import { IntegrationsValidator } from '@services/integrations/integrations.validator';
import { Integration } from '@entity/integrations/integration.entity';
import { AppleCalDAVIntegration } from '@entity/integrations/apple/apple-caldav-integration.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { IntegrationResponseDto } from '@dto/integrations/integration-response.dto';
import { CreateAppleCalDAVRequestDto } from '@dto/integrations/apple/create-apple-cal-dav-request.dto';
import { CreateIntegrationResponseDto } from '@dto/integrations/create-integration-response.dto';
import { Public } from '@app/auth/strategy/jwt/public.decorator';
import { ValidateQueryParamPipe } from '@app/pipes/validate-query-param/validate-query-param.pipe';
import { AppleCalendarIntegrationsExceptionFilter } from '@app/filters/integrations/calendar-integrations/apple-calendar-integrations/apple-calendar-integrations-exception.filter';

/**
 * Sign up with Google API is located on token controller.
 */
@Controller(`:vendor((${Object.values(IntegrationVendor).join('|')}))`)
export class VendorIntegrationsController {
    constructor(
        private readonly integrationsServiceLocator: IntegrationsServiceLocator,
        private readonly integrationsValidator: IntegrationsValidator,
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    @Get('redirect')
    @Public()
    redirectForOAuth2(
        @Query('authorization', ValidateQueryParamPipe) syncdayAccessToken: string,
        @Param('vendor') vendor: IntegrationVendor,
        @Res() response: Response
    ): void {

        const integrationService = this.integrationsServiceLocator.getIntegrationFactory(vendor);
        const redriectURI = integrationService.generateOAuth2RedirectURI(syncdayAccessToken);

        response.writeHead(301, { Location: redriectURI });
        response.end();
    }

    @Get('callback')
    @Public()
    async callbackForOAuth2(
        @Query('code') authorizationCode: string,
        @Param('vendor') vendor: IntegrationVendor,
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

        const decodedAppJwtPayload = this.jwtService.decode(stateParams.accessToken) as AppJwtPayload;

        const integrationService = this.integrationsServiceLocator.getIntegrationFactory(vendor);
        const integrationFacacde = this.integrationsServiceLocator.getFacade(vendor);

        const issuedToken = await integrationFacacde.issueToken(authorizationCode);

        const loadedOAuth2User = await integrationFacacde.fetchOAuth2User(issuedToken);

        const loadedAppUserByEmail = await this.userService.findUserByLocalAuth({
            id: decodedAppJwtPayload.userId,
            email: decodedAppJwtPayload.email
        });

        this.logger.info({
            message: 'Integration is requested',
            vendor,
            decodedAppJwtPayload
        });

        if (!loadedAppUserByEmail) {
            throw new BadRequestException(`Invalid user request - email: ${ decodedAppJwtPayload.email }`);
        }

        const profile = loadedAppUserByEmail.profiles.find((_profile) =>
            _profile.id === decodedAppJwtPayload.id
        );

        if (profile === undefined) {
            throw new BadRequestException('No detected profile');
        }

        await integrationService.create(
            profile,
            issuedToken,
            loadedOAuth2User
        );

        const oauth2SuccessRedirectURI = integrationFacacde.getOAuth2SuccessRedirectURI();

        const redirectURL = new URL(oauth2SuccessRedirectURI);

        response.redirect(redirectURL.toString());
    }

    @Get()
    async searchIntegrations(
        @AuthProfile('id') profileId: number,
        @Param('vendor') vendor: IntegrationVendor,
        @Query('withCalendarIntegrations') withCalendarIntegrations: string | boolean
    ): Promise<Array<Integration | IntegrationResponseDto>> {

        withCalendarIntegrations = withCalendarIntegrations === 'true';

        const integrationService = this.integrationsServiceLocator.getIntegrationFactory(vendor);

        const integrations = await integrationService.search({
            profileId,
            withCalendarIntegrations
        });

        return integrations.map(
            (_integration) => plainToInstance(IntegrationResponseDto, _integration, {
                excludeExtraneousValues: true
            })
        );
    }

    @Post()
    @UseFilters(new AppleCalendarIntegrationsExceptionFilter())
    async createIntegration(
        @AuthProfile() authProfile: AppJwtPayload,
        @Param('vendor') vendor: IntegrationVendor,
        @Body() newIntegration: CreateAppleCalDAVRequestDto
    ): Promise<Integration> {
        const integrationService = this.integrationsServiceLocator.getIntegrationFactory(vendor);

        const loadedAppUser = await this.userService.findUserByLocalAuth({
            id: authProfile.userId,
            email: authProfile.email
        });

        if (!loadedAppUser) {

            this.logger.error({
                message: 'Error while invalid user requests to create an integration',
                authProfile
            });

            throw new BadRequestException('Invalid user request exception');
        }

        await this.integrationsValidator.validateMaxAddLimit(
            this.integrationsServiceLocator,
            authProfile.id
        );

        const profile = loadedAppUser.profiles.find((_profile) => _profile.id === authProfile.id) as Profile;

        const createdIntegration = await integrationService.create(
            profile,
            loadedAppUser.userSetting,
            profile.team.teamSetting,
            newIntegration,
            newIntegration.timezone
        );

        return plainToInstance(CreateIntegrationResponseDto, createdIntegration, {
            excludeExtraneousValues: true
        }) as Integration;
    }

    @Patch(':vendorIntegrationId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    patchVendorIntegration(
        @AuthProfile() profile: Profile,
        @Param('vendor') vendor: IntegrationVendor,
        @Param('vendorIntegrationId', ParseIntPipe) vendorIntegrationId: number,
        @Body() partialAppleCalDavIntegration: Partial<AppleCalDAVIntegration>
    ): Observable<boolean> {

        const integrationService = this.integrationsServiceLocator.getIntegrationFactory(vendor);

        return integrationService.patch(vendorIntegrationId, profile.id, partialAppleCalDavIntegration);
    }

    @Delete(':vendorIntegrationId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @AuthProfile('id') profileId: number,
        @Param('vendor') vendor: IntegrationVendor,
        @Param('vendorIntegrationId', ParseIntPipe) vendorIntegrationId: number
    ): Promise<void> {
        const integrationService = this.integrationsServiceLocator.getIntegrationFactory(vendor);
        await integrationService.remove(vendorIntegrationId, profileId);
    }
}
