import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Availability } from '@core/entities/availability/availability.entity';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { EventsModule } from '@services/events/events.module';
import { UtilModule } from '@services/util/util.module';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Availability]),
        SyncdayRedisModule,
        UtilModule,
        EventsModule
    ],
    controllers: [AvailabilityController],
    providers: [AvailabilityService, AvailabilityRedisRepository],
    exports: [AvailabilityService, AvailabilityRedisRepository]
})
export class AvailabilityModule {}
