import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    Inject,
    Logger,
    UnauthorizedException
} from '@nestjs/common';
import { Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { EntityNotFoundError } from 'typeorm';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    static _instance: GlobalExceptionFilter;

    constructor() {
        if (!GlobalExceptionFilter._instance) {
            GlobalExceptionFilter._instance = this;
        }
        return GlobalExceptionFilter._instance;
    }

    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

    catch(exception: EntityNotFoundError | HttpException, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let message = (exception as any).response?.message;

        const status = (exception as HttpException).getStatus?.() || 500;

        if (status / 100 === 5) {
            message = 'Server error happend.';
        } else if (exception instanceof UnauthorizedException) {
            message = 'Unauthoized Information.';
        }

        this.logger.error({
            message: exception.message,
            stack: exception.stack,
            name: exception.name
        });

        response.status(status).json({
            statusCode: status,
            message
        });
    }
}
