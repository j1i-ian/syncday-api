import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Observable } from 'rxjs';
import { Logger } from 'winston';

@Injectable()
export class GlobalInterceptor implements NestInterceptor {

    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {

        const http = context.switchToHttp();
        const request = http.getRequest();

        const requestLog = {
            url: request.url,
            method: request.method,
            params: request.params,
            rawHeaders: request.rawHeaders,
            body: request.body,
            ip: request.ip,
            protocol: request.protocol
        };

        // skip aws health check request
        const isBlackListUrl = this.isBlackListUrl(request.url as string);

        if (isBlackListUrl === false) {
            this.logger.info({
                message: 'request logged',
                requestLog
            });
        }

        return next.handle();
    }

    isBlackListUrl(url: string): boolean {
        return url === '/' ||
            url === '/v1';
    }
}
