import { Module } from '@nestjs/common';
import { EventsModule } from '@services/events/events.module';
import { AvailabilityModule } from '@services/availabilities/availability.module';
import { ScheduledEventsModule } from '@services/scheduled-events/scheduled-events.module';
import { TeamModule } from '@services/teams/team.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
    imports: [
        TeamModule,
        AvailabilityModule,
        EventsModule,
        ScheduledEventsModule
    ],
    controllers: [BookingsController],
    providers: [BookingsService]
})
export class BookingsModule {}
