import { IsDefined, IsEmail } from 'class-validator';

export class UpdateVerificationDto {
    @IsDefined()
    @IsEmail()
    email: string;

    @IsDefined()
    verificationCode: string;
}
