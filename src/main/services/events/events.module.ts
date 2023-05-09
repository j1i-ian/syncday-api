import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '@core/entities/events/event.entity';
import { EventRedisRepository } from '@services/events/event.redis-repository';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Event])],
    controllers: [EventsController],
    providers: [EventRedisRepository, SyncdayRedisService, EventsService]
})
export class EventsModule {}
