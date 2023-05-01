import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventGroupsModule } from '@services/event-groups/event-groups.module';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { Event } from '@entity/events/event.entity';
import { SyncdayRedisModule } from '../../syncday-redis/syncday-redis.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([EventGroup, Event, EventDetail]),
        SyncdayRedisModule,
        forwardRef(() => EventGroupsModule)
    ],
    controllers: [EventsController],
    providers: [EventsService],
    exports: [EventsService]
})
export class EventsModule {}
