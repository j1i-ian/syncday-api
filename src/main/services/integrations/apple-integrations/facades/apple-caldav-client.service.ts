import { Injectable } from '@nestjs/common';
import { DAVClient } from 'tsdav';
import { AppleCalDAVCredential } from '@interfaces/integrations/apple/apple-cal-dav-credentials.interface';

@Injectable()
export class AppleCaldavClientService {

    async generateCalDAVClient(appleCalDAVCredential: AppleCalDAVCredential): Promise<DAVClient> {

        const icloudCalDAVUrl = this.icloudCalDAVUrl;

        const client = new DAVClient({
            serverUrl: icloudCalDAVUrl,
            credentials: appleCalDAVCredential,
            authMethod: 'Basic',
            defaultAccountType: 'caldav'
        });

        await client.login();

        return client;
    }

    get icloudCalDAVUrl(): string {
        return 'https://caldav.icloud.com';
    }
}
