import { Injectable } from '@nestjs/common';
import { DAVCalendar, DAVClient, DAVObject } from 'tsdav';
import { CreatedCalendarEvent } from '@core/interfaces/integrations/created-calendar-event.interface';
import { AppleCalDAVCredential } from '@interfaces/integrations/apple/apple-cal-dav-credentials.interface';
import { AppleCaldavClientService } from '@services/integrations/apple-integrations/facades/apple-caldav-client.service';
import { AppleCalendarListService } from '@services/integrations/apple-integrations/facades/apple-calendar-list.service';
import { AppleCalendarEventListService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-list.service';
import { AppleCalendarEventCreateService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-create.service';
import { AppleConverterService } from '@services/integrations/apple-integrations/apple-converter/apple-converter.service';
import { AppleCalendarEventPatchService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-patch.service';
import { Schedule } from '@entity/schedules/schedule.entity';

@Injectable()
export class AppleIntegrationFacadeService {
    constructor(
        private readonly appleConverterService: AppleConverterService,
        private readonly appleCaldavClientService: AppleCaldavClientService,
        private readonly appleCalendarListService: AppleCalendarListService,
        private readonly appleCalendarEventListService: AppleCalendarEventListService,
        private readonly appleCalendarEventCreateService: AppleCalendarEventCreateService,
        private readonly appleCalendarEventPatchService: AppleCalendarEventPatchService
    ) {}

    generateCalDAVClient(appleCalDAVCredential: AppleCalDAVCredential): Promise<DAVClient> {

        return this.appleCaldavClientService.generateCalDAVClient(appleCalDAVCredential);
    }

    searchCalendars(client: DAVClient): Promise<DAVCalendar[]> {
        return this.appleCalendarListService.search(client);
    }

    searchSchedules(
        client: DAVClient,
        calendarDAVUrl: string,
        until?: Date | undefined
    ): Promise<DAVObject[]> {

        if (!until) {
            const today = new Date();
            const _3monthAfter = new Date(new Date().setMonth(today.getMonth() + 3));

            until = _3monthAfter;
        }

        return this.appleCalendarEventListService.search(
            client,
            calendarDAVUrl,
            until
        );
    }

    async createCalendarEvent(
        client: DAVClient,
        calendarDAVUrl: string,
        schedule: Schedule
    ): Promise<CreatedCalendarEvent> {

        const organizerEmail = client.credentials.username as string;
        const iCalICSString = this.appleConverterService.convertScheduleToICalICSString(
            organizerEmail,
            schedule
        );

        const generatedCalDavEventUrl = await this.appleCalendarEventCreateService.create(
            client,
            calendarDAVUrl,
            schedule,
            iCalICSString
        );

        return {
            iCalUID: schedule.uuid,
            generatedEventUrl: generatedCalDavEventUrl
        } as CreatedCalendarEvent;
    }

    async updateCalendarEvent(
        client: DAVClient,
        calendarEventUrl: string,
        schedule: Schedule
    ): Promise<boolean> {

        const organizerEmail = client.credentials.username as string;
        const patchedICalICSString = this.appleConverterService.convertScheduleToICalICSString(
            organizerEmail,
            schedule
        );

        const updated = await this.appleCalendarEventPatchService.patch(
            client,
            calendarEventUrl,
            patchedICalICSString
        );

        return !!updated;
    }
}
