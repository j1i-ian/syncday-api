import { Expose } from 'class-transformer';

export class CreateZoomMeetingIntegrationResponse {
    @Expose()
    id: number;

    @Expose()
    email: string;
}
