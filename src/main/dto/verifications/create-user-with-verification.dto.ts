import { IsDefined, IsEmail } from 'class-validator';

export class CreateUserWithVerificationDto {
    @IsDefined()
    @IsEmail()
    email: string;

    @IsDefined()
    verificationCode: string;
}
