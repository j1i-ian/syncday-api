import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@entity/users/user.entity';
import { AppJwtPayload } from '../auth/strategy/jwt/app-jwt-payload.interface';

export const AuthUser = createParamDecorator(
    (data: Extract<keyof AppJwtPayload, keyof User>, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();

        const userOrNull: AppJwtPayload | null = request.user ?? null;

        let authData = null;
        if (userOrNull && data) {
            authData = data ? userOrNull[data] : userOrNull;
        } else {
            authData = userOrNull;
        }

        return authData;
    }
);
