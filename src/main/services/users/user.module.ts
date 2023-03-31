import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@entity/users/user.entity';
import { TokenModule } from '../../auth/token/token.module';
import { UserSettingModule } from './user-setting/user-setting.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
    imports: [TypeOrmModule.forFeature([User]), UserSettingModule, TokenModule],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
})
export class UserModule {}
