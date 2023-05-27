import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { GoogleIntegrationModule } from '@services/integrations/google-integration/google-integration.module';
import { AppConfigService } from '../../../configs/app-config.service';
import { UserModule } from '../../services/users/user.module';
import { IntegrationsModule } from '../../services/integrations/integrations.module';
import { TokenController } from './token.controller';
import { TokenService } from './token.service';

@Module({
    imports: [
        JwtModule.registerAsync(AppConfigService.getJwtModuleOptions()),
        forwardRef(() => UserModule),
        ConfigModule,
        IntegrationsModule,
        GoogleIntegrationModule
    ],
    controllers: [TokenController],
    providers: [TokenService, JwtService],
    exports: [TokenService, JwtService]
})
export class TokenModule {}