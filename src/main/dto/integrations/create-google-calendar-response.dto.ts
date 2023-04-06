import { Expose } from 'class-transformer';

export class CreateGoogleCalendarResponseDto {
    @Expose()
    id: number;

    @Expose()
    uuid: string;

    @Expose()
    email: string;
}
