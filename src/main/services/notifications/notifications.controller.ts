import { Body, Controller, Header, Post } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { AuthUser } from '@decorators/auth-user.decorator';
import { AppJwtPayload } from '@interfaces/users/app-jwt-payload';
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
        @AuthUser() authUser: AppJwtPayload,
        @Body() bookingAskRequestDto: BookingAskRequestDto
    ): Observable<boolean> {

        const {
            eventId,
            hostName,
            inviteeName,
            inviteePhoneNumber,
            memo
        } = bookingAskRequestDto;

        const ensuredHostName = hostName || authUser.name;

        return from(this.notificationsService.sendBookingRequest(
            authUser.id,
            eventId,
            ensuredHostName,
            inviteeName,
            inviteePhoneNumber,
            memo
        ));
    }
}
