import fetch from 'node-fetch';
import { ZoomCreateConferenceLinkResponseDTO } from '@app/interfaces/integrations/zoom/zoom-create-meeting-response.interface';
import { ZoomCreateConferenceLinkRequestDTO } from '@app/interfaces/integrations/zoom/zoom-create-meeting-request.interface';

export class ZoomCreateConferenceLinkService {
    async createZoomMeeting(
        zoomAccessToken: string,
        zoomCreateConferenceLinkRequestDTO: Partial<ZoomCreateConferenceLinkRequestDTO>
    ): Promise<ZoomCreateConferenceLinkResponseDTO> {

        const headers = this.getHeaders(zoomAccessToken);

        const createZoomMeetingResponse = await fetch(this.url, {
            method: 'POST',
            body: JSON.stringify(zoomCreateConferenceLinkRequestDTO),
            headers
        });

        const createdZoomMeeting: ZoomCreateConferenceLinkResponseDTO = await createZoomMeetingResponse.json();

        return createdZoomMeeting;
    }

    getHeaders(zoomAccessToken: string): { [header: string]: string } {
        return {
            'Content-type': 'application/json',
            Authorization: `Bearer ${zoomAccessToken}`
        };
    }

    get url(): string {
        return 'https://api.zoom.us/v2/users/me/meetings';
    }
}
