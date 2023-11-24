import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KakaotalkIntegrationsModule } from '@services/integrations/kakaotalk-integrations/kakaotalk-integrations.module';
import { UserModule } from '@services/users/user.module';
import { KakaoOAuth2TokenService } from './kakao-oauth2-token.service';

@Module({
    imports: [
        ConfigModule,
        UserModule,
        KakaotalkIntegrationsModule
    ],
    providers: [KakaoOAuth2TokenService],
    exports: [KakaoOAuth2TokenService]
})
export class KakaoOAuth2TokenModule {}
