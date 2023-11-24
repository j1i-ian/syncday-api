import { Module } from '@nestjs/common';
import { GoogleOAuth2TokenModule } from '@services/oauth2/google-oauth2-token/google-oauth2-token.module';
import { OAuth2TokenServiceLocator } from '@services/oauth2/oauth2-token.service-locator';
import { KakaoOAuth2TokenModule } from './kakao-oauth2-token/kakao-oauth2-token.module';

@Module({
    imports: [
        GoogleOAuth2TokenModule,
        KakaoOAuth2TokenModule
    ],
    providers: [OAuth2TokenServiceLocator],
    exports: [OAuth2TokenServiceLocator]
})
export class OAuth2Module {}
