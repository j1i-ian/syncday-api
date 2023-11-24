/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { IntegrationsFacade } from '@services/integrations/integrations.facade.interface';
import { KakaotalkIssueOAuth2TokenService } from '@services/integrations/kakaotalk-integrations/facades/kakaotalk-issue-oauth2-token.service';
import { KakaotalkFetchOAuth2UserProfileService } from '@services/integrations/kakaotalk-integrations/facades/kakaotalk-fetch-oauth2-user-profile.service';
import { KakaotalkUserProfileResponse } from '@app/interfaces/integrations/kakaotalk/kakaotalk-user-profile-response.interface';

@Injectable()
export class KakaotalkIntegrationsFacade implements IntegrationsFacade {

    constructor(
        private readonly configService: ConfigService,
        private readonly kakaotalkIssueOAuth2TokenService: KakaotalkIssueOAuth2TokenService,
        private readonly kakaotalkFetchOAuth2UserProfileService: KakaotalkFetchOAuth2UserProfileService
    ) {
        const oauth2Setting = AppConfigService.getOAuth2Setting(
            IntegrationVendor.KAKAOTALK,
            this.configService
        );

        this.clientId = oauth2Setting.clientId;
        this.redirectURI = oauth2Setting.redirectURI;
    }

    clientId: string;
    redirectURI: string;

    issueToken(authorizationCode: string): Promise<OAuthToken> {

        return this.kakaotalkIssueOAuth2TokenService.issueOAuthTokenByAuthorizationCode(
            authorizationCode,
            this.clientId,
            this.redirectURI
        );
    }

    issueTokenByRefreshToken(refreshToken: string): Promise<OAuthToken> {
        throw new Error('Method not implemented.');
    }

    fetchOAuth2User(oauth2Token: OAuthToken): Promise<KakaotalkUserProfileResponse> {
        return this.kakaotalkFetchOAuth2UserProfileService.getOAuth2UserProfile(oauth2Token);
    }

    getOAuth2SuccessRedirectURI(): string {
        throw new Error('Method not implemented.');
    }
}
