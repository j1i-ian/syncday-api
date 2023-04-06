import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@entity/users/user.entity';
import { TokenModule } from '../../auth/token/token.module';
import { UserSetting } from '../../../@core/core/entities/users/user-setting.entity';
import { VerificationModule } from '../../auth/verification/verification.module';
import { UserSettingModule } from './user-setting/user-setting.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, UserSetting]),
        UserSettingModule,
        TokenModule,
        VerificationModule
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
})
export class UserModule {}
