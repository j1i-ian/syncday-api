import { CustomDecorator, SetMetadata } from '@nestjs/common';
import { PublicDecoratorOptions } from './public-decorator-options.interface';

export const PUBLIC_SETTING_KEY = 'publicSetting';
export const Public = (options?: PublicDecoratorOptions | undefined): CustomDecorator => {
    if (options?.ignoreInvalidJwtToken === undefined) {
        options = { ignoreInvalidJwtToken: true };
    }

    const ignoreInvalidJwtToken = options.ignoreInvalidJwtToken;

    return SetMetadata(PUBLIC_SETTING_KEY, { ignoreInvalidJwtToken });
};
