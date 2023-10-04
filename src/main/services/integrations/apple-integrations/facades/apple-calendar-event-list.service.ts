import { Injectable } from '@nestjs/common';
import { DAVClient, DAVObject, getBasicAuthHeaders } from 'tsdav';

@Injectable()
export class AppleCalendarEventListService {

    async search(
        client: DAVClient,
        calDavUrl: string,
        until: Date
    ): Promise<DAVObject[]> {

        const headers = getBasicAuthHeaders(client.credentials);

        const calDAVSchedules = await client.fetchCalendarObjects({
            calendar: {
                url: calDavUrl
            },
            expand: true,
            timeRange: {
                start: new Date().toISOString(),
                end: until.toISOString()
            },
            headers
        });

        return calDAVSchedules;
    }
}
