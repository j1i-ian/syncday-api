import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UserService } from '@services/users/user.service';
import { User } from '@entity/users/user.entity';

// TODO: test case 만들어줘야됨
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private userService: UserService) {
        super({
            usernameField: 'email',
            passwordField: 'plainPassword',
            session: false,
            passReqToCallback: false
        });
    }

    async validate(email: string, password: string): Promise<User | null> {
        const validatedUserOrNull = await this.userService.validateEmailAndPassword(
            email,
            password
        );

        if (validatedUserOrNull === null) {
            throw new UnauthorizedException('email or password is wrong.');
        }

        return validatedUserOrNull;
    }
}
