import { Injectable } from '@nestjs/common';
import * as ical from 'ical';
import { plainToInstance } from 'class-transformer';
import { DAVCalendar, DAVObject } from 'tsdav';
import { AppleCalDAVCalendarIntegration } from '@entity/integrations/apple/apple-caldav-calendar-integration.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { ParsedICSBody } from '@app/interfaces/integrations/parsed-ics-body.interface';

interface ParsedICS { [iCalUID: string]: ParsedICSBody }

@Injectable()
export class AppleConverterService {

    convertCalDAVCalendarToAppleCalendarIntegration(
        userTimezone: string,
        webDAVCalendar: DAVCalendar
    ): AppleCalDAVCalendarIntegration {

        const isInvalidTimezone = webDAVCalendar.timezone === '' || !webDAVCalendar.timezone;
        const ensuredTimezone = isInvalidTimezone ? userTimezone: webDAVCalendar.timezone;

        return plainToInstance(AppleCalDAVCalendarIntegration, {
            calDavSyncToken: webDAVCalendar.syncToken,
            calDavCTag: webDAVCalendar.ctag,
            calDavUrl: webDAVCalendar.url,
            name: (webDAVCalendar.description || webDAVCalendar.displayName) ?? '',
            color: (webDAVCalendar as DAVCalendar & { calendarColor: string }).calendarColor,
            timezone: ensuredTimezone,
            primary: false,
            setting: {
                conflictCheck: false,
                outboundWriteSync: false,
                inboundDecliningSync: false
            }
        } as AppleCalDAVCalendarIntegration);
    }

    convertCalDAVCalendarObjectsToAppleCalDAVIntegrationSchedules(
        userUUID: string,
        userWorkspace: string,
        userTimezone: string,
        calDAVObject: DAVObject
    ): AppleCalDAVIntegrationSchedule[] {

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const parsedICS = ical.parseICS(calDAVObject.data) as unknown as ParsedICS;

        const convertedAppleSchedules = Object.values(parsedICS).map((_parsedSchedule) => {

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const timezone = (_parsedSchedule.created as any).tz || userTimezone;
            const startDate = new Date(_parsedSchedule.start);
            const endDate = new Date(_parsedSchedule.end);

            return plainToInstance(AppleCalDAVIntegrationSchedule, {
                name: _parsedSchedule.summary,
                host: {
                    uuid: userUUID,
                    timezone,
                    workspace: userWorkspace
                },
                scheduledTime: {
                    startTimestamp: startDate,
                    endTimestamp: endDate
                },
                scheduledBufferTime: {
                    startBufferTimestamp: null,
                    endBufferTimestamp: null
                },
                iCalUID: _parsedSchedule.uid
            });
        });

        return convertedAppleSchedules;
    }

}
