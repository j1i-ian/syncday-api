import { Body, Controller, Header, Post } from '@nestjs/common';
import { Observable, defer, from } from 'rxjs';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { NotificationsService } from '@services/notifications/notifications.service';
import { BookingAskRequestDto } from '@dto/notifications/booking-ask-request.dto';

@Controller()
export class NotificationsController {

    constructor(
        private readonly notificationsService: NotificationsService
    ) {}

    @Post()
    @Header('Content-type', 'application/json')
    createNotification(
        @AuthProfile() authProfile: AppJwtPayload,
        @Body() bookingAskRequestDto: BookingAskRequestDto
    ): Observable<boolean> {

        const {
            eventId,
            hostName,
            inviteeName,
            inviteePhoneNumber,
            memo
        } = bookingAskRequestDto;

        const ensuredHostName = hostName || authProfile.name;

        return defer(() => from(this.notificationsService.sendBookingRequest(
            authProfile.teamId,
            eventId,
            ensuredHostName,
            inviteeName,
            inviteePhoneNumber,
            memo
        )));
    }
}
