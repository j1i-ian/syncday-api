import { Expose } from 'class-transformer';

export class CreateUserRequestDto {
    @Expose()
    email: string;

    @Expose()
    plainPassword?: string | undefined;

    @Expose()
    nickname: string;

    @Expose()
    timezone?: string;
}
