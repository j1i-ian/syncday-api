import { Expose } from 'class-transformer';

export class CreateTemporaryUserResponseDto {
    @Expose()
    email: string;

    @Expose()
    nickname: string;
}
