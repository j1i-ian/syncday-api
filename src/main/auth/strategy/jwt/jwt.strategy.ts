import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppJwtPayload } from './app-jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly configService: ConfigService) {
        super({
            usernameField: 'email',
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET')
        });
    }

    /**
     * passport.js 의 default validate 가 실행된 후에 작동되기 때문에
     * return true 만 해줘도 됨.
     *
     * @param appJwtPayload
     * @returns {AppJwtPayload} AppJwtPayload
     */
    async validate(appJwtPayload: AppJwtPayload): Promise<AppJwtPayload> {
        return Promise.resolve(appJwtPayload);
    }
}
