import { Body, Controller, HttpCode, HttpStatus, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { EventDetailsService } from '@services/events/event-details/event-details.service';
import { EventDetail } from '@entity/events/event-detail.entity';

@Controller()
export class EventDetailsController {
    constructor(private readonly eventDetailsService: EventDetailsService) {}

    @Patch(':eventDetailId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async patch(
        @AuthProfile('teamId') teamId: number,
        @Param('eventDetailId', ParseIntPipe) eventDetailId: number,
        @Body() patchEventDetailDto: Partial<EventDetail>
    ): Promise<void> {
        await this.eventDetailsService.patch(eventDetailId, teamId, patchEventDetailDto );
    }
}
