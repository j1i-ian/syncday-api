/* eslint-disable @typescript-eslint/no-unused-vars */
import { URL } from 'url';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '@configs/app-config.service';
import { OAuth2AccountUserProfileMetaInfo } from '@interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { OAuth2Setting } from '@interfaces/auth/oauth2-setting.interface';
import { SyncdayOAuth2StateParams } from '@interfaces/integrations/syncday-oauth2-state-params.interface';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { SyncdayOAuth2TokenResponse } from '@interfaces/auth/syncday-oauth2-token-response.interface';
import { KakaotalkUserProfileResponse } from '@interfaces/integrations/kakaotalk/kakaotalk-user-profile-response.interface';
import { OAuth2TokenService } from '@services/integrations/oauth2-token-service.interface';
import { KakaotalkIntegrationsFacade } from '@services/integrations/kakaotalk-integrations/kakaotalk-integrations.facade';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { OAuth2Converter } from '@services/integrations/oauth2-converter.interface';
import { User } from '@entities/users/user.entity';
import { OAuth2Account } from '@entities/users/oauth2-account.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';

@Injectable()
export class KakaoOAuth2TokenService implements OAuth2TokenService {

    constructor(
        private readonly configService: ConfigService,
        private readonly oauth2AccountsService: OAuth2AccountsService,
        private readonly kakaotalkIntegrationFacade: KakaotalkIntegrationsFacade
    ) {
        this.oauth2Setting = AppConfigService.getOAuth2Setting(
            IntegrationVendor.KAKAOTALK,
            this.configService
        );
    }

    oauth2Setting: OAuth2Setting;

    generateOAuth2AuthoizationUrl(
        integrationContext: IntegrationContext,
        timezone: string | null,
        decodedUserOrNull: User | null
    ): string {

        const stateParams = {
            integrationContext,
            requestUserEmail: decodedUserOrNull?.email,
            timezone
        } as SyncdayOAuth2StateParams;

        const jsonStringifiedStateParams = JSON.stringify(stateParams);

        const authorizationUrl = new URL('https://kauth.kakao.com/oauth/authorize');
        authorizationUrl.searchParams.append('response_type', 'code');
        authorizationUrl.searchParams.append('client_id', this.oauth2Setting.clientId);
        authorizationUrl.searchParams.append('redirect_uri', this.oauth2Setting.redirectURI);
        authorizationUrl.searchParams.append('state', jsonStringifiedStateParams);

        return authorizationUrl.toString();
    }

    /**
     * Currently, Kakaotalk is not used for integrating services other than OAuth2 sign-in
     *
     * @param syncdayGoogleOAuthTokenResponse
     */
    generateOAuth2RedirectURI(
        syncdayGoogleOAuthTokenResponse: SyncdayOAuth2TokenResponse
    ): string {
        throw new Error('Method not implemented.');
    }

    async getOAuth2UserProfile(
        authorizationCode: string
    ): Promise<KakaotalkUserProfileResponse> {
        const oauth2Token =
            await this.kakaotalkIntegrationFacade.issueToken(authorizationCode);

        const fetchedKakaotalkUserProfile = await this.kakaotalkIntegrationFacade.fetchOAuth2User(oauth2Token);

        return fetchedKakaotalkUserProfile;
    }

    async multipleSocialSignIn(
        user: User,
        ensuredRequesterEmail: string
    ): Promise<void> {
        await this.oauth2AccountsService.create(user, {
            email: ensuredRequesterEmail,
            oauth2Type: OAuth2Type.KAKAOTALK
        } as OAuth2Account);
    }

    integrate(
        oauth2UserProfile: OAuth2AccountUserProfileMetaInfo,
        user: User
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    getEmailFromOAuth2UserProfile(
        oauth2UserProfile: KakaotalkUserProfileResponse
    ): string {
        return oauth2UserProfile.kakao_account.email;
    }

    get converter(): OAuth2Converter {
        return <OAuth2Converter>{
            convertToCreateUserRequestDTO: (
                timezone: string,
                oauth2AccountUserProfileMetaInfo: KakaotalkUserProfileResponse
            ) => {

                const { kakao_account, oauth2Token } = oauth2AccountUserProfileMetaInfo;
                const { email, profile } = kakao_account;
                const { nickname, is_default_image, thumbnail_image_url: profileThumbnailImageUrl } = profile;
                const oauth2UserProfileImageUrl = is_default_image ? null : profileThumbnailImageUrl;

                const createUserRequestDto: CreateUserRequestDto = {
                    email,
                    name: nickname,
                    timezone
                };

                return {
                    oauth2Type: OAuth2Type.KAKAOTALK,
                    createUserRequestDto,
                    oauth2Token,
                    oauth2UserProfile: {
                        oauth2UserEmail: email,
                        oauth2UserProfileImageUrl
                    }
                };
            }
        };
    }
}
