import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { EventsModule } from './events/events.module';
import { EventGroupsController } from './event-groups.controller';
import { EventGroupsService } from './event-groups.service';

@Module({
    imports: [TypeOrmModule.forFeature([EventGroup]), EventsModule],
    controllers: [EventGroupsController],
    providers: [EventGroupsService]
})
export class EventGroupsModule {}
