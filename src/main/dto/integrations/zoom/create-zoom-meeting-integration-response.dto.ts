import { Expose } from 'class-transformer';

export class CreateZoomMeetingIntegrationResponse {
    @Expose()
    id: number;

    @Expose()
    accessToken: string;

    @Expose()
    refreshToken: string;
}
