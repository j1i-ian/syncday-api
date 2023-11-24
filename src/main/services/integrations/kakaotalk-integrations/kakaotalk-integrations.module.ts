import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KakaotalkIntegrationsFacade } from '@services/integrations/kakaotalk-integrations/kakaotalk-integrations.facade';
import { KakaotalkIntegrationsService } from './kakaotalk-integrations.service';
import { KakaotalkFetchOAuth2UserProfileService } from './facades/kakaotalk-fetch-oauth2-user-profile.service';
import { KakaotalkIssueOAuth2TokenService } from './facades/kakaotalk-issue-oauth2-token.service';

@Module({
    imports: [
        ConfigModule
    ],
    providers: [
        KakaotalkIntegrationsService,
        KakaotalkIntegrationsFacade,
        KakaotalkFetchOAuth2UserProfileService,
        KakaotalkIssueOAuth2TokenService
    ],
    exports: [
        KakaotalkIntegrationsService,
        KakaotalkIntegrationsFacade
    ]
})
export class KakaotalkIntegrationsModule {}
