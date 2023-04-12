import { IsDefined } from 'class-validator';

export class CreateZoomMeetingIntegrationRequest {
    @IsDefined()
    zoomAuthCode: string;
}
