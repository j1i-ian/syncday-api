import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { Profile } from '@entities/profiles/profile.entity';

export const AuthProfile = createParamDecorator(
    (data: Extract<keyof AppJwtPayload, keyof Profile | 'teamUUID' | 'userUUID'>, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();

        const profileOrNull: AppJwtPayload | null = request.user ?? null;

        let authData = null;
        if (profileOrNull && data) {
            authData = data ? profileOrNull[data] : profileOrNull;
        } else {
            authData = profileOrNull;
        }

        return authData;
    }
);
