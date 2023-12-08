import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from '@entity/teams/team.entity';
import { TeamSettingModule } from './team-setting/team-setting.module';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([ Team ]),
        TeamSettingModule
    ],
    controllers: [TeamController],
    providers: [TeamService],
    exports: [TeamService]
})
export class TeamModule {}
