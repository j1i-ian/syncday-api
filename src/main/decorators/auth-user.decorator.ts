import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@entity/users/user.entity';

export const AuthUser = createParamDecorator((data: keyof User, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();

    const userOrNull: User | null = request.user ?? null;

    let authData = null;
    if (userOrNull && data) {
        authData = data ? userOrNull[data] : userOrNull;
    } else {
        authData = userOrNull;
    }

    return authData;
});
