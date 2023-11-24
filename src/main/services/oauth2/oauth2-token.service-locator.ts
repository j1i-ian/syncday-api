import { BadRequestException, Injectable } from '@nestjs/common';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { OAuth2TokenService } from '@services/integrations/oauth2-token-service.interface';
import { GoogleOAuth2TokenService } from '@services/oauth2/google-oauth2-token/google-oauth2-token.service';
import { KakaoOAuth2TokenService } from '@services/oauth2/kakao-oauth2-token/kakao-oauth2-token.service';

@Injectable()
export class OAuth2TokenServiceLocator {

    constructor(
        private readonly googleOAuth2TokenService: GoogleOAuth2TokenService,
        private readonly kakaoOAuth2TokenService: KakaoOAuth2TokenService
    ) {}

    get(integrationVendor: IntegrationVendor): OAuth2TokenService {

        let myOAuth2TokenService;

        switch (integrationVendor) {
            case IntegrationVendor.GOOGLE:
                myOAuth2TokenService = this.googleOAuth2TokenService;
                break;
            case IntegrationVendor.KAKAOTALK:
                myOAuth2TokenService = this.kakaoOAuth2TokenService;
                break;
            case IntegrationVendor.ZOOM:
            case IntegrationVendor.APPLE:
            default:
                throw new BadRequestException('Not yet implemented');
        }

        return myOAuth2TokenService;
    }
}
