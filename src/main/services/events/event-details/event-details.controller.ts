import { Body, Controller, HttpCode, HttpStatus, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { AuthUser } from '@decorators/auth-user.decorator';
import { EventDetailsService } from '@services/events/event-details/event-details.service';
import { EventDetail } from '@entity/events/event-detail.entity';

@Controller()
export class EventDetailsController {
    constructor(private readonly eventDetailsService: EventDetailsService) {}

    @Patch(':eventDetailId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async patch(
        @AuthUser('id') userId: number,
        @Param('eventDetailId', ParseIntPipe) eventDetailId: number,
        @Body() patchEventDetailDto: Partial<EventDetail>
    ): Promise<void> {
        await this.eventDetailsService.patch(eventDetailId, userId, patchEventDetailDto );
    }
}
