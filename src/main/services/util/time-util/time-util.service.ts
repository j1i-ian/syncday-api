import { BadRequestException, Injectable } from '@nestjs/common';
import { Attendee, DateArray, createEvent } from 'ics';
import { NotificationType } from '@interfaces/notifications/notification-type.enum';
import { Schedule } from '@entity/schedules/schedule.entity';

@Injectable()
export class TimeUtilService {
    /**
     * Calendar object resources contained in calendar collections MUST NOT specify
     * the iCalendar METHOD property.
     *
     * @see {@link [RFC4791](https://datatracker.ietf.org/doc/html/rfc4791#section-4.1) }
     */
    convertToICSString(
        uuid: string,
        organizerEmail: string,
        schedule: Schedule
    ): string {
        const {
            name,
            scheduledTime: {
                startTimestamp,
                endTimestamp
            },
            description,
            location,
            host,
            inviteeAnswers,
            scheduledEventNotifications
        } = schedule;

        const startDate = new Date(startTimestamp);
        const endDate = new Date(endTimestamp);

        const inviteeName = inviteeAnswers[0].name;
        const attendees: Attendee[] = scheduledEventNotifications.filter(
            (_scheduledEventNotification) =>
                _scheduledEventNotification.notificationType === NotificationType.EMAIL
        ).map((_emailEventNotification) => ({
            email: _emailEventNotification.reminderValue,
            name: inviteeName,
            partstat: 'NEEDS-ACTION'
        } as Attendee));

        const startDateTimeArray = [
            startDate.getUTCFullYear(),
            startDate.getUTCMonth() + 1,
            startDate.getUTCDate(),
            startDate.getUTCHours(),
            startDate.getUTCMinutes()
        ] as DateArray;

        const duration = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);

        /** We generate the ICS files */
        const { error, value: iCalString } = createEvent({
            uid: uuid,
            startInputType: 'utc',
            start: startDateTimeArray,
            duration: {
                seconds: duration
            },
            title: name,
            description,
            location: location.join('\n'),
            organizer: {
                email: organizerEmail,
                name: host.name
            },
            attendees
        });

        if (error || !iCalString) {
            throw new BadRequestException('Cannot create ICS String');
        }

        return iCalString.replace(/METHOD:[^\r\n]+\r\n/g, '');
    }

    getTimezoneGMTString(timezone: string): string | undefined {

        const formatOptions = {
            timeZone: timezone,
            timeZoneName: 'longOffset'
        } as Intl.DateTimeFormatOptions;

        const formatter = new Intl.DateTimeFormat('en-GB', formatOptions);
        const formattedDate = formatter.format(new Date());

        const gmtExtractExpression = /.*(?<timezoneDiff>GMT[-+]\d\d:\d\d).*/;
        const matchedGMTStringGroup = formattedDate
            .match(gmtExtractExpression)?.groups;

        return matchedGMTStringGroup?.timezoneDiff;
    }
}
