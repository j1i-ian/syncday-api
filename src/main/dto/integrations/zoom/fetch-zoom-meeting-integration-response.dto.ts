import { Expose } from 'class-transformer';

export class FetchZoomMeetingIntegrationResponse {
    @Expose()
    id: number;

    @Expose()
    email: string;
}
