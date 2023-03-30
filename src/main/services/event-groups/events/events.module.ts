import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
    imports: [TypeOrmModule.forFeature([EventGroup])],
    controllers: [EventsController],
    providers: [EventsService]
})
export class EventsModule {}
