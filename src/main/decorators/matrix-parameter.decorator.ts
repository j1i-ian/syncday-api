import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const MatrixParameter = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const urlPart = request.path.split(';');
    const result: { [key: string]: string[] } = {};

    for (let i = 1; i < urlPart.length; i++) {
        const parameterPart = urlPart[i].split('=');
        const key = parameterPart[0];
        const value = parameterPart[1];
        const hasProperty = Object.prototype.hasOwnProperty.call(result, key);

        if (hasProperty) {
            result[key].push(value);
        } else {
            result[key] = [value];
        }
    }

    return result;
});
