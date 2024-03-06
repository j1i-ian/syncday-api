/* eslint-disable @typescript-eslint/no-unused-vars */
import { URL } from 'url';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2AccountUserProfileMetaInfo } from '@core/interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { OAuth2Setting } from '@core/interfaces/auth/oauth2-setting.interface';
import { SyncdayOAuth2StateParams } from '@core/interfaces/integrations/syncday-oauth2-state-params.interface';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { OAuth2TokenService } from '@services/integrations/oauth2-token-service.interface';
import { KakaotalkIntegrationsFacade } from '@services/integrations/kakaotalk-integrations/kakaotalk-integrations.facade';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { OAuth2Converter } from '@services/integrations/oauth2-converter.interface';
import { User } from '@entity/users/user.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { SyncdayOAuth2TokenResponse } from '@app/interfaces/auth/syncday-oauth2-token-response.interface';
import { KakaotalkUserProfileResponse } from '@app/interfaces/integrations/kakaotalk/kakaotalk-user-profile-response.interface';

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
        decodedAppJwtPayloadOrNull: AppJwtPayload | null
    ): string {

        const stateParams = {
            integrationContext,
            requestUserEmail: decodedAppJwtPayloadOrNull?.email,
            profileId: decodedAppJwtPayloadOrNull?.id,
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

    getPhoneNumberFromOAuth2UserProfile(
        oauth2UserProfile: KakaotalkUserProfileResponse
    ): string {
        // kakao account phone number format is '+82 10-1234-1234'
        return oauth2UserProfile.kakao_account.phone_number
            .replaceAll('-', '')
            .replaceAll(' ', '');
    }

    get converter(): OAuth2Converter {
        return <OAuth2Converter>{
            convertToCreateUserRequestDTO: (
                timezone: string,
                oauth2AccountUserProfileMetaInfo: KakaotalkUserProfileResponse
            ) => {

                const { kakao_account, oauth2Token } = oauth2AccountUserProfileMetaInfo;
                const { email, profile } = kakao_account;
                const {
                    nickname,
                    is_default_image,
                    thumbnail_image_url: profileThumbnailImageUrl
                } = profile;
                const oauth2UserProfileImageUrl = is_default_image ? null : profileThumbnailImageUrl;

                const phoneNumber = this.getPhoneNumberFromOAuth2UserProfile(oauth2AccountUserProfileMetaInfo);

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
                        oauth2UserPhoneNumber: phoneNumber,
                        oauth2UserProfileImageUrl
                    }
                };
            }
        };
    }
}
