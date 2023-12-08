import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { TeamSettingService } from './team-setting.service';
import { TeamSettingController } from './team-setting.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([TeamSetting]),
        SyncdayRedisModule
    ],
    controllers: [TeamSettingController],
    providers: [TeamSettingService],
    exports: [TeamSettingService]
})
export class TeamSettingModule {}
