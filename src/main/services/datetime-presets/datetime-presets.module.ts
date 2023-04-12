import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatetimePreset } from '@entity/datetime-presets/datetime-preset.entity';
import { DatetimePresetsController } from './datetime-presets.controller';
import { DatetimePresetsService } from './datetime-presets.service';
import { UserModule } from '../users/user.module';
import { SyncdayRedisModule } from '../syncday-redis/syncday-redis.module';

@Module({
    imports: [TypeOrmModule.forFeature([DatetimePreset]), UserModule, SyncdayRedisModule],
    controllers: [DatetimePresetsController],
    providers: [DatetimePresetsService]
})
export class DatetimePresetsModule {}
