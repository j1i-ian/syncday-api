import { Body, Controller, Header, Post } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { NotificationsService } from '@services/notifications/notifications.service';
import { BookingRequestDto } from '@dto/notifications/booking-request.dto';

@Controller()
export class NotificationsController {

    constructor(
        private readonly notificationsService: NotificationsService
    ) {}

    @Post()
    @Header('Content-type', 'application/json')
    createNotification(
        @AuthProfile() authProfile: AppJwtPayload,
        @Body() bookingRequestDto: BookingRequestDto
    ): Observable<boolean> {

        const {
            eventId,
            reminderType,
            hostName,
            inviteeName,
            inviteePhoneNumber,
            additionalMessage,
            language
        } = bookingRequestDto;

        const ensuredHostName = hostName || authProfile.name;

        return from(this.notificationsService.sendBookingRequest(
            authProfile.teamId,
            eventId,
            reminderType,
            ensuredHostName,
            inviteeName,
            inviteePhoneNumber,
            additionalMessage,
            language
        ));
    }
}
