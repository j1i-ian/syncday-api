import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../auth.service';

// TODO: test case 만들어줘야됨
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService) {
        super({
            usernameField: 'email',
            session: false
        });
    }

    async validate(email: string, password: string): Promise<boolean> {
        const isValid = await this.authService.validateEmail(email, password);

        if (!isValid) {
            throw new UnauthorizedException('아이디 혹은 패스워드가 잘못되었습니다.');
        }

        return isValid;
    }
}
