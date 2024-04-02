import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { GoogleIntegrationModule } from '@services/integrations/google-integration/google-integration.module';
import { OAuth2AccountsModule } from '@services/users/oauth2-accounts/oauth2-accounts.module';
import { NotificationsModule } from '@services/notifications/notifications.module';
import { UserModule } from '@services/users/user.module';
import { OAuth2Module } from '@services/oauth2/oauth2.module';
import { ProfilesModule } from '@services/profiles/profiles.module';
import { TeamModule } from '@services/team/team.module';
import { AppConfigService } from '../../../configs/app-config.service';
import { IntegrationsModule } from '../../services/integrations/integrations.module';
import { TokenController } from './token.controller';
import { TokenService } from './token.service';

@Module({
    imports: [
        JwtModule.registerAsync(AppConfigService.getJwtModuleOptions()),
        ConfigModule,
        IntegrationsModule,
        GoogleIntegrationModule,
        OAuth2AccountsModule,
        NotificationsModule,
        UserModule,
        ProfilesModule,
        OAuth2Module,
        TeamModule
    ],
    controllers: [TokenController],
    providers: [TokenService, JwtService],
    exports: [TokenService, JwtService]
})
export class TokenModule {}
