import { Injectable } from '@nestjs/common';
import { DAVCalendar, DAVClient } from 'tsdav';

@Injectable()
export class AppleCalendarListService {

    async search(client: DAVClient): Promise<DAVCalendar[]> {

        const calendars = await client.fetchCalendars();

        // Filter events for users' calendar
        return calendars
            .filter((_webDAVCalendar) => _webDAVCalendar.components?.includes('VEVENT'));
    }
}
