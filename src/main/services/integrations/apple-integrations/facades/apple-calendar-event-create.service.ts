import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { DAVClient, DAVResponse, getBasicAuthHeaders } from 'tsdav';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Schedule } from '@entity/schedules/schedule.entity';

@Injectable()
export class AppleCalendarEventCreateService {

    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    async create(
        client: DAVClient,
        calDavUrl: string,
        schedule: Schedule,
        iCalICSEventString: string
    ): Promise<string> {

        const filename = `${schedule.uuid}.ics`;
        const headers = getBasicAuthHeaders(client.credentials);

        const response: DAVResponse & { url: string } = await client.createCalendarObject({
            calendar: {
                url: calDavUrl
            },
            filename,
            headers,
            iCalString: iCalICSEventString
        });

        if (response.ok === false) {
            this.logger.error({
                responseOk: response.ok,
                responseStatus: response.status,
                responseStatusText: response.statusText
            });

            throw new BadRequestException('Cannot create iCalendar event');
        }

        const generatedCalDavEventUrl = response.url;

        return generatedCalDavEventUrl;
    }
}
