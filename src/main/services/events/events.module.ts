import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '@core/entities/events/event.entity';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Event])],
    controllers: [EventsController],
    providers: [EventsRedisRepository, SyncdayRedisService, EventsService]
})
export class EventsModule {}
