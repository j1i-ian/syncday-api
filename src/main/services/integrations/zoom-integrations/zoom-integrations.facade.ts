import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { OAuth2UserProfile } from '@core/interfaces/integrations/oauth2-user-profile.interface';
import { AppConfigService } from '@config/app-config.service';
import { ZoomOauthTokenService } from '@services/integrations/zoom-integrations/facades/zoom-oauth-token.service';
import { ZoomOauthUserService } from '@services/integrations/zoom-integrations/facades/zoom-oauth-user.service';
import { IntegrationsFacade } from '@services/integrations/integrations.facade.interface';
import { ZoomCreateMeetingService } from '@services/integrations/zoom-integrations/facades/zoom-create-meeting.service';
import { ZoomCreateMeetingResponseDTO } from '@app/interfaces/integrations/zoom/zoom-create-meeting-response.interface';
import { ZoomCreateMeetingRequestDTO } from '@app/interfaces/integrations/zoom/zoom-create-meeting-request.interface';

@Injectable()
export class ZoomIntegrationFacade implements IntegrationsFacade {

    constructor(
        private readonly configService: ConfigService,
        private readonly zoomOauthTokenService: ZoomOauthTokenService,
        private readonly zoomOauthUserService: ZoomOauthUserService,
        private readonly zoomCreateMeetingService: ZoomCreateMeetingService
    ) {
        const zoomCredentials = AppConfigService.getZoomCredentials(configService);
        this.basicAuth = AppConfigService.getBase64Encoded(zoomCredentials.clientId, zoomCredentials.clientSecret);

        this.redirectURI = AppConfigService.getZoomRedirectUri(
            this.configService
        );
        this.oauth2SuccessRedirectURI = AppConfigService.getZoomOAuth2SuccessRedirectURI(
            this.configService
        );
    }

    oauth2SuccessRedirectURI: string;
    redirectURI: string;
    basicAuth: string;

    getOAuth2SuccessRedirectURI(): string {
        return this.oauth2SuccessRedirectURI;
    }

    async issueToken(
        authorizationCode: string
    ): Promise<OAuthToken> {

        return this.zoomOauthTokenService.issueOAuthTokenByAuthorizationCode(
            authorizationCode,
            this.basicAuth,
            this.redirectURI
        );
    }

    async issueTokenByRefreshToken(refreshToken: string): Promise<OAuthToken> {
        return this.zoomOauthTokenService.issueOAuthTokenByRefreshToken(
            this.basicAuth,
            refreshToken
        );
    }

    async fetchOAuth2User(oauth2Token: OAuthToken): Promise<OAuth2UserProfile> {
        return await this.zoomOauthUserService.getZoomUser(oauth2Token.accessToken);
    }

    async createMeeting(accessToken: string, zoomCreateMeetingRequestDTO: Partial<ZoomCreateMeetingRequestDTO>): Promise<ZoomCreateMeetingResponseDTO> {
        return await this.zoomCreateMeetingService.createZoomMeeting(accessToken, zoomCreateMeetingRequestDTO);
    }
}
