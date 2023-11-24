/* eslint-disable @typescript-eslint/no-unused-vars */
import { URL } from 'url';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2UserProfile } from '@core/interfaces/integrations/oauth2-user-profile.interface';
import { OAuth2Setting } from '@core/interfaces/auth/oauth2-setting.interface';
import { SyncdayOAuth2StateParams } from '@core/interfaces/integrations/syncday-oauth2-state-params.interface';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { OAuth2TokenService } from '@services/integrations/oauth2-token-service.interface';
import { KakaotalkIntegrationsFacade } from '@services/integrations/kakaotalk-integrations/kakaotalk-integrations.facade';
import { UserService } from '@services/users/user.service';
import { User } from '@entity/users/user.entity';
import { Integration } from '@entity/integrations/integration.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { Language } from '@app/enums/language.enum';
import { SyncdayOAuth2TokenResponse } from '@app/interfaces/auth/syncday-oauth2-token-response.interface';
import { KakaotalkUserProfileResponse } from '@app/interfaces/integrations/kakaotalk/kakaotalk-user-profile-response.interface';

@Injectable()
export class KakaoOAuth2TokenService implements OAuth2TokenService {

    constructor(
        private readonly configService: ConfigService,
        private readonly userService: UserService,
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

    async signUpWithOAuth(
        timezone: string,
        oauth2UserProfile: KakaotalkUserProfileResponse,
        language: Language
    ): Promise<User> {

        const { kakao_account, oauth2Token } = oauth2UserProfile;
        const { email, profile } = kakao_account;
        const { nickname, is_default_image, thumbnail_image_url: profileThumbnailImageUrl } = profile;
        const oauth2UserProfileImageUrl = is_default_image ? null : profileThumbnailImageUrl;

        const createUserRequestDto: CreateUserRequestDto = {
            email,
            name: nickname,
            timezone
        };
        const oauth2UserEmail = email;

        const signedUpUser = await this.userService.createUserByOAuth2(
            OAuth2Type.KAKAOTALK,
            createUserRequestDto,
            oauth2Token,
            {
                oauth2UserEmail,
                oauth2UserProfileImageUrl
            },
            language
        );

        // TODO: send notification for user with Kakao Alimtalk ..

        return signedUpUser;
    }

    multipleSocialSignIn(
        user: User,
        ensuredRequesterEmail: string
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    integrate(
        oauth2UserProfile: OAuth2UserProfile,
        user: User
    ): Promise<void> {
        throw new Error('Method not implemented.');
    }

    getEmailFromOAuth2UserProfile(
        oauth2UserProfile: KakaotalkUserProfileResponse
    ): string {
        return oauth2UserProfile.kakao_account.email;
    }

    /**
     * Currently, Kakaotalk is not being used
     * for any other service integration
     * except for OAuth2
     *
     * @param loadedUserOrNull Cu
     * @param oauth2UserEmail
     * @returns {Integration | null}
     */
    getIntegrationFromUser(
        loadedUserOrNull: User | null,
        oauth2UserEmail: string
    ): Integration | null {
        return null;
    }
}
