import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { DAVClient, DAVResponse, getBasicAuthHeaders } from 'tsdav';

@Injectable()
export class AppleCalendarEventPatchService {

    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    async patch(
        client: DAVClient,
        calDavEventUrl: string,
        updatedICalICSEventString: string
    ): Promise<string> {

        const headers = getBasicAuthHeaders(client.credentials);

        const response: DAVResponse & { url: string } = await client.updateCalendarObject({
            calendarObject: {
                url: calDavEventUrl,
                data: updatedICalICSEventString,
                etag: ''
            },
            headers
        });

        if (response.ok === false) {
            this.logger.error({
                responseOk: response.ok,
                responseStatus: response.status,
                responseStatusText: response.statusText
            });

            throw new BadRequestException('Cannot create iCalendar event');
        }

        const patchedCalDavEventUrl = response.url;

        return patchedCalDavEventUrl;
    }

}
