import { Injectable } from '@nestjs/common';
import { DAVCalendar, DAVClient, DAVObject } from 'tsdav';
import { CreatedCalendarEvent } from '@interfaces/integrations/created-calendar-event.interface';
import { AppleCalDAVCredential } from '@interfaces/integrations/apple/apple-cal-dav-credentials.interface';
import { CoreAppleConverterService } from '@services/converters/apple/core-apple-converter.service';
import { AppleCaldavClientService } from '@services/integrations/apple-integrations/facades/apple-caldav-client.service';
import { AppleCalendarListService } from '@services/integrations/apple-integrations/facades/apple-calendar-list.service';
import { AppleCalendarEventListService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-list.service';
import { AppleCalendarEventCreateService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-create.service';
import { AppleCalendarEventPatchService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-patch.service';
import { ScheduledEvent } from '@entities/scheduled-events/scheduled-event.entity';

@Injectable()
export class AppleIntegrationFacadeService {
    constructor(
        private readonly coreAppleConverterService: CoreAppleConverterService,
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

    searchScheduledEvents(
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
        scheduledEvent: ScheduledEvent
    ): Promise<CreatedCalendarEvent> {

        const organizerEmail = client.credentials.username as string;
        const iCalICSString = this.coreAppleConverterService.convertScheduleToICalICSString(
            organizerEmail,
            scheduledEvent
        );

        const generatedCalDavEventUrl = await this.appleCalendarEventCreateService.create(
            client,
            calendarDAVUrl,
            scheduledEvent,
            iCalICSString
        );

        return {
            iCalUID: scheduledEvent.uuid,
            generatedEventUrl: generatedCalDavEventUrl
        } as CreatedCalendarEvent;
    }

    async updateCalendarEvent(
        client: DAVClient,
        calendarEventUrl: string,
        scheduledEvent: ScheduledEvent
    ): Promise<boolean> {

        const organizerEmail = client.credentials.username as string;
        const patchedICalICSString = this.coreAppleConverterService.convertScheduleToICalICSString(
            organizerEmail,
            scheduledEvent
        );

        const updated = await this.appleCalendarEventPatchService.patch(
            client,
            calendarEventUrl,
            patchedICalICSString
        );

        return !!updated;
    }
}
