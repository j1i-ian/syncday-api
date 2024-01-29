import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { EventDetail } from '@entity/events/event-detail.entity';
import { EventDetailsService } from './event-details.service';
import { EventDetailsController } from './event-details.controller';

@Module({
    imports: [TypeOrmModule.forFeature([EventDetail]), SyncdayRedisModule],
    controllers: [EventDetailsController],
    providers: [EventsRedisRepository, EventDetailsService],
    exports: [EventDetailsService]
})
export class EventDetailsModule {}
