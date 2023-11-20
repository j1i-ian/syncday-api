import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { OAuth2AccountsService } from './oauth2-accounts.service';
import { Oauth2AccountsController } from './oauth2-accounts.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([OAuth2Account])
    ],
    providers: [OAuth2AccountsService],
    exports: [OAuth2AccountsService],
    controllers: [Oauth2AccountsController]
})
export class OAuth2AccountsModule {}
