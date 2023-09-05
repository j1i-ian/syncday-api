import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { OAuth2AccountsService } from './oauth2-accounts.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([OAuth2Account])
    ],
    providers: [OAuth2AccountsService],
    exports: [OAuth2AccountsService]
})
export class OAuth2AccountsModule {}
