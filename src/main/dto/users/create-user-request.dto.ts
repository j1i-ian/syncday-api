import { IsDefined, IsEmail } from 'class-validator';

export class CreateUserRequestDto {
    @IsEmail({})
    @IsDefined()
    email: string;

    @IsDefined()
    plainPassword: string;

    @IsDefined()
    nickname: string;

    @IsDefined()
    phone: string;
}
