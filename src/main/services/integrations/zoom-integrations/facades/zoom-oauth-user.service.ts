import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import { ZoomUserResponseDTO } from '@app/interfaces/integrations/zoom/zoom-user-response.interface';

@Injectable()
export class ZoomOauthUserService {

    async getZoomUser(zoomAccessToken: string): Promise<ZoomUserResponseDTO> {
        const headers = this.getHeaders(zoomAccessToken);

        const zoomUserResponse = await fetch(this.url, {
            headers
        });

        const zoomUser: ZoomUserResponseDTO = await zoomUserResponse.json();

        return zoomUser;
    }

    getHeaders(zoomAccessToken: string): { [header: string]: string } {
        return {
            Authorization: `Bearer ${zoomAccessToken}`
        };
    }

    get url(): string {
        return 'https://api.zoom.us/v2/users/me';
    }
}
