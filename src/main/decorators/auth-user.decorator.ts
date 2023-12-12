import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { User } from '@entity/users/user.entity';

/**
 * AuthUser decorator is utilized to parse result of local strategy
 */
export const AuthUser = createParamDecorator(
    (data: Extract<keyof AppJwtPayload, keyof User>, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();

        return request.user ?? null;
    }
);
