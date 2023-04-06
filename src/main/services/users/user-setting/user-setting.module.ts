import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSetting } from '../../../../@core/core/entities/users/user-setting.entity';
import { SyncdayRedisModule } from '../../syncday-redis/syncday-redis.module';
import { UserSettingController } from './user-setting.controller';
import { UserSettingService } from './user-setting.service';

@Module({
    imports: [TypeOrmModule.forFeature([UserSetting]), SyncdayRedisModule],
    controllers: [UserSettingController],
    providers: [UserSettingService],
    exports: [UserSettingService]
})
export class UserSettingModule {}
