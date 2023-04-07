import { IsDefined, IsEmail } from 'class-validator';

export class CreateTemporaryUserRequestDto {
    @IsEmail({})
    @IsDefined()
    email: string;

    @IsDefined()
    plainPassword: string;

    @IsDefined()
    nickname: string;
}
