import { Module } from '@nestjs/common';
import { EventsModule } from '@services/events/events.module';
import { AvailabilityModule } from '@services/availability/availability.module';
import { SchedulesModule } from '@services/schedules/schedules.module';
import { TeamModule } from '@services/team/team.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
    imports: [
        TeamModule,
        AvailabilityModule,
        EventsModule,
        SchedulesModule
    ],
    controllers: [BookingsController],
    providers: [BookingsService]
})
export class BookingsModule {}
