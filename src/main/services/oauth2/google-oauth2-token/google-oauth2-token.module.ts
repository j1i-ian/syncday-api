import { Module } from '@nestjs/common';
import { GoogleIntegrationModule } from '@services/integrations/google-integration/google-integration.module';
import { GoogleOAuth2TokenService } from '@services/oauth2/google-oauth2-token/google-oauth2-token.service';
import { IntegrationsModule } from '@services/integrations/integrations.module';
import { NotificationsModule } from '@services/notifications/notifications.module';
import { OAuth2AccountsModule } from '@services/users/oauth2-accounts/oauth2-accounts.module';
import { UserModule } from '@services/users/user.module';

@Module({
    imports: [
        GoogleIntegrationModule,
        UserModule,
        OAuth2AccountsModule,
        IntegrationsModule,
        NotificationsModule
    ],
    providers: [GoogleOAuth2TokenService],
    exports: [GoogleOAuth2TokenService]
})
export class GoogleOAuth2TokenModule {}
