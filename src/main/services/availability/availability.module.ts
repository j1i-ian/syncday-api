import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Availability } from '@core/entities/availability/availability.entity';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Availability]), SyncdayRedisModule],
    controllers: [AvailabilityController],
    providers: [AvailabilityService]
})
export class AvailabilityModule {}
