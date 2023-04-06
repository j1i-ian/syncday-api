import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@entity/users/user.entity';
import { VerificationModule } from '../../auth/verification/verification.module';
import { TokenModule } from '../../auth/token/token.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { UserSettingModule } from './user-setting/user-setting.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        VerificationModule,
        forwardRef(() => IntegrationsModule),
        forwardRef(() => TokenModule),
        UserSettingModule
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
})
export class UserModule {}
