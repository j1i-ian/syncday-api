import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '@decorators/roles.decorator';
import { Role } from '@interfaces/profiles/role.enum';
import { Profile } from '@entity/profiles/profile.entity';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass()
        ]);

        const noRoleRequired = !requiredRoles || requiredRoles?.length === 0;

        if (noRoleRequired) {
            return true;
        } else {

            const expressRequest = context.switchToHttp().getRequest<Request>();
            const profile = expressRequest.user as Profile;
            return requiredRoles.some((role) => profile.roles?.includes(role));
        }

    }
}
