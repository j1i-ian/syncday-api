import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../../configs/app-config.service';
import { TokenController } from './token.controller';
import { TokenService } from './token.service';

@Module({
    imports: [ConfigModule, JwtModule.registerAsync(AppConfigService.getJwtModuleOptions())],
    controllers: [TokenController],
    providers: [TokenService, JwtService],
    exports: [TokenService, JwtService]
})
export class TokenModule {}
