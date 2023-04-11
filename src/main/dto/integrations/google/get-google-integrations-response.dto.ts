import { Expose } from 'class-transformer';

export class GetGoogleIntegrationsResponseDto {
    @Expose()
    id: number;

    @Expose()
    uuid: string;

    @Expose()
    email: string;

    @Expose()
    createdAt: Date;

    @Expose()
    updatedAt: Date;
}
