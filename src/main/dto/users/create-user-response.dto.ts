import { Expose } from 'class-transformer';

export class CreateUserResponseDto {
    @Expose()
    id: number;

    @Expose()
    uuid: string;

    @Expose()
    email: string;

    @Expose()
    nickname: string;
}
