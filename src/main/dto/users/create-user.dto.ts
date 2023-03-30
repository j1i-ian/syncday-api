import { IsDefined, IsEmail } from 'class-validator';

export class CreateUserDto {
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
