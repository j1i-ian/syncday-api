import { IsDefined, IsEmail } from 'class-validator';

export class CreateVerificationDto {
    @IsDefined()
    @IsEmail()
    email: string;
}
