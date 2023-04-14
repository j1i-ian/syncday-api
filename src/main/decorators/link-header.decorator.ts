import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const LinkHeader = createParamDecorator<{ [key: string]: string[] }>(
    (data: unknown, ctx: ExecutionContext) => {
        const request: Request = ctx.switchToHttp().getRequest();
        const linkHeader = request.headers['link'] ? (request.headers['link'] as string) : '';
        const parsedHeader = parseLinkHeader(linkHeader);

        return parsedHeader;
    }
);

function parseLinkHeader(linkHeader: string): { [key: string]: string[] } {
    const links = linkHeader.split(',');
    const result: Record<string, string[]> = {};

    links.forEach((link) => {
        const match = link.match(/<(.+)>;\s*rel="(.+)"/);
        if (match) {
            const url = match[1];
            const rel = match[2];
            result[rel] = result[rel] ? [...result[rel], url] : [url];
        }
    });

    return result;
}
