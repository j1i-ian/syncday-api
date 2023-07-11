import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { EventsModule } from '@services/events/events.module';
import { Schedule } from '@entity/schedules/schedule.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { SchedulesService } from './schedules.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([Schedule, GoogleIntegrationSchedule]),
        SyncdayRedisModule,
        EventsModule
    ],
    providers: [SchedulesService, SchedulesRedisRepository],
    exports: [SchedulesService]
})
export class SchedulesModule {}
