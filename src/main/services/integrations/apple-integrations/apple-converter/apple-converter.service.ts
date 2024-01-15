import { Injectable } from '@nestjs/common';
import * as ical from 'ical';
import { plainToInstance } from 'class-transformer';
import { DAVCalendar, DAVObject } from 'tsdav';
import { TimeUtilService } from '@services/util/time-util/time-util.service';
import { AppleCalDAVCalendarIntegration } from '@entity/integrations/apple/apple-caldav-calendar-integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { AppleCalDAVIntegrationScheduledEvent } from '@entity/integrations/apple/apple-caldav-integration-scheduled-event.entity';
import { ParsedICSBody } from '@app/interfaces/integrations/parsed-ics-body.interface';

interface ParsedICS { [iCalUID: string]: ParsedICSBody }

@Injectable()
export class AppleConverterService {

    constructor(
        private readonly timeUtilService: TimeUtilService
    ) {}

    convertScheduleToICalICSString(
        organizerEmail: string,
        scheduledEvent: ScheduledEvent
    ): string {

        return this.timeUtilService.convertToICSString(
            scheduledEvent.uuid,
            organizerEmail,
            scheduledEvent
        );
    }

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
                conflictCheck: true,
                outboundWriteSync: false,
                inboundDecliningSync: false
            }
        } as AppleCalDAVCalendarIntegration);
    }

    convertCalDAVCalendarObjectToAppleCalDAVIntegrationScheduledEvents(
        profile: Profile,
        userSetting: UserSetting,
        teamSetting: TeamSetting,
        calDAVObject: DAVObject
    ): AppleCalDAVIntegrationScheduledEvent[] {

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const parsedICS = ical.parseICS(calDAVObject.data) as unknown as ParsedICS;

        const convertedAppleSchedules = Object.values(parsedICS).map((_parsedSchedule) => {

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const timezone = (_parsedSchedule.created as any)?.tz as string | undefined || userSetting.preferredTimezone;
            const gmtString = this.timeUtilService.getTimezoneGMTString(timezone) ?? '';

            const startDate = new Date(`${ _parsedSchedule.start as string }${gmtString}`);
            const endDate = new Date(`${_parsedSchedule.end as string }${gmtString}`);

            return plainToInstance(AppleCalDAVIntegrationScheduledEvent, {
                name: _parsedSchedule.summary,
                host: {
                    uuid: profile.uuid,
                    name: profile.name,
                    timezone,
                    workspace: teamSetting.workspace
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
            } as AppleCalDAVIntegrationScheduledEvent);
        });

        return convertedAppleSchedules;
    }

}
