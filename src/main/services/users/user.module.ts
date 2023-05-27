import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityModule } from '@services/availability/availability.module';
import { User } from '@entity/users/user.entity';
import { VerificationModule } from '../../auth/verification/verification.module';
import { TokenModule } from '../../auth/token/token.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserSettingModule } from './user-setting/user-setting.module';
import { TemporaryUsersModule } from './temporary-users/temporary-users.module';
import { SyncdayRedisModule } from '../syncday-redis/syncday-redis.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User]),
        VerificationModule,
        forwardRef(() => TokenModule),
        UserSettingModule,
        SyncdayRedisModule,
        TemporaryUsersModule,
        AvailabilityModule
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
})
export class UserModule {}
