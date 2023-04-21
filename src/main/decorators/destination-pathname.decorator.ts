import { URL } from 'url';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const DestinationPathname = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const destinationHeader = request.headers['destination']
        ? (request.headers['destination'] as string)
        : '';
    const url = new URL(destinationHeader);

    return url.pathname;
});
