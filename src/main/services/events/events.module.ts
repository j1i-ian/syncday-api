import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '@core/entities/events/event.entity';
import { EventGroup } from '@core/entities/events/evnet-group.entity';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UserSettingModule } from '@services/users/user-setting/user-setting.module';
import { SyncdayCriteriaModule } from '@criteria/syncday-criteria.module';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventDetailsController } from './event-details/event-details.controller';
import { EventDetailsModule } from './event-details/event-details.module';

@Module({
    imports: [TypeOrmModule.forFeature([EventGroup, Event]), SyncdayCriteriaModule, UserSettingModule, EventDetailsModule],
    controllers: [EventsController, EventDetailsController],
    providers: [EventsRedisRepository, SyncdayRedisService, EventsService],
    exports: [EventsService, EventsRedisRepository]
})
export class EventsModule {}
