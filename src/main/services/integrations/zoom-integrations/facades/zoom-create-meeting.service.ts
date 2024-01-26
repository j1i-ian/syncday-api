import fetch from 'node-fetch';
import { ZoomCreateMeetingResponseDTO } from '@interfaces/integrations/zoom/zoom-create-meeting-response.interface';
import { ZoomCreateMeetingRequestDTO } from '@interfaces/integrations/zoom/zoom-create-meeting-request.interface';

export class ZoomCreateMeetingService {
    async createZoomMeeting(
        zoomAccessToken: string,
        zoomCreateMeetingRequestDTO: Partial<ZoomCreateMeetingRequestDTO>
    ): Promise<ZoomCreateMeetingResponseDTO> {

        const headers = this.getHeaders(zoomAccessToken);

        const createZoomMeetingResponse = await fetch(this.url, {
            method: 'POST',
            body: JSON.stringify(zoomCreateMeetingRequestDTO),
            headers
        });

        const createdZoomMeeting: ZoomCreateMeetingResponseDTO = await createZoomMeetingResponse.json();

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
