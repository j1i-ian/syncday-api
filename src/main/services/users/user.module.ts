import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@entity/users/user.entity';
import { TokenModule } from '../../auth/token/token.module';
import { UserSetting } from '../../../@core/core/entities/users/user-setting.entity';
import { UserSettingModule } from './user-setting/user-setting.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        TypeOrmModule.forFeature([UserSetting]),
        UserSettingModule,
        TokenModule,
        IntegrationsModule
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
})
export class UserModule {}
