import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { EmailOrPasswordMismatchException } from '@core/exceptions/auth/email-or-password-mismatch.exception';
import { UserService } from '@services/users/user.service';
import { User } from '@entity/users/user.entity';
import { CreateTokenRequestDto } from '@dto/auth/tokens/create-token-request.dto';

// TODO: test case 만들어줘야됨
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private userService: UserService) {
        super({
            usernameField: 'loginId' as CreateTokenRequestDto['loginId'],
            passwordField: 'plainPassword' as CreateTokenRequestDto['plainPassword'],
            session: false,
            passReqToCallback: false
        });
    }

    async validate(emailOrPhoneNumber: string, password: string): Promise<User | null> {

        let phone: string | null = null;
        let email: string | null = null;

        const isEmail = emailOrPhoneNumber.includes('@');
        const isKoreanPhoneNumber = emailOrPhoneNumber.startsWith('010');

        if (isEmail) {
            email = emailOrPhoneNumber;
        } else {
            if (isKoreanPhoneNumber) {
                phone = emailOrPhoneNumber.replace('010', '+8210');
            } else {
                phone = emailOrPhoneNumber;
            }
        }

        const validatedUserOrNull = await this.userService.validateEmailAndPassword(
            {
                email,
                phone
            },
            password
        );

        if (validatedUserOrNull === null) {

            const errorMessageHead = isEmail ? 'email' : 'phoneNumber';
            throw new EmailOrPasswordMismatchException(errorMessageHead + ' or password is wrong.');
        }

        return validatedUserOrNull;
    }
}
