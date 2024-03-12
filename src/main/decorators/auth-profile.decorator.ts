import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { AuthProfileOption } from '@interfaces/decorators/auth-profile-option.interface';
import { NoRemainingSignInMethodException } from '@app/exceptions/users/no-remaining-sign-in-method.exception';

type AuthProfileParameterType = AuthProfileOption['property'] | AuthProfileOption;

const parseAuthProfileOption = (
    _authProfileOption: AuthProfileParameterType | undefined
): AuthProfileOption => {
    let defaultAuthProfileOption = {
        property: null,
        nullCheck: false,
        nullCheckException: new NoRemainingSignInMethodException()
    } as AuthProfileOption;

    const hasOption = _authProfileOption !== undefined;

    if (hasOption) {
        if (typeof _authProfileOption === typeof '') {
            defaultAuthProfileOption.property = _authProfileOption as AuthProfileOption['property'];
        } else {
            defaultAuthProfileOption = _authProfileOption as AuthProfileOption;
        }
    }

    return defaultAuthProfileOption;
};

export const AuthProfile = createParamDecorator(
    (rawAuthProfileOption: AuthProfileParameterType | undefined, ctx: ExecutionContext) => {

        const authProfileOption = parseAuthProfileOption(rawAuthProfileOption);

        const request = ctx.switchToHttp().getRequest();

        const profileOrNull: AppJwtPayload | null = request.user as AppJwtPayload | undefined ?? null;

        let parsedAppJwtPayloadOrProperty: AppJwtPayload | AppJwtPayload[keyof AppJwtPayload] = null;

        const isPropertyAccess = !!(profileOrNull && authProfileOption.property);

        if (isPropertyAccess) {
            parsedAppJwtPayloadOrProperty = profileOrNull[authProfileOption.property as keyof AppJwtPayload];
        } else {
            parsedAppJwtPayloadOrProperty = profileOrNull as AppJwtPayload;
        }

        if (authProfileOption.nullCheck) {
            throw authProfileOption.nullCheckException;
        }

        return parsedAppJwtPayloadOrProperty;
    }
);
