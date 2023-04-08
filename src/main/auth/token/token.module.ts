import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../../configs/app-config.service';
import { UserModule } from '../../services/users/user.module';
import { IntegrationsModule } from '../../services/integrations/integrations.module';
import { TokenController } from './token.controller';
import { TokenService } from './token.service';

@Module({
    imports: [
        forwardRef(() => UserModule),
        ConfigModule,
        IntegrationsModule,
        JwtModule.registerAsync(AppConfigService.getJwtModuleOptions())
    ],
    controllers: [TokenController],
    providers: [TokenService, JwtService],
    exports: [TokenService, JwtService]
})
export class TokenModule {}
