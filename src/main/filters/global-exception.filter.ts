import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    Inject,
    Logger,
    NotImplementedException,
    UnauthorizedException
} from '@nestjs/common';
import { Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { EntityNotFoundError } from 'typeorm';
import { CannotFindAvailabilityBody } from '@app/exceptions/availability/cannot-find-availability-body.exception';

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

        if (this.isWhiteListedException(exception as HttpException)) {
            message = exception.message || 'Unauthoized Information.';
        } else if (status / 100 === 5) {
            message = 'Server error happend.';
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

    isWhiteListedException(exception: HttpException): boolean {
        return (
            exception instanceof UnauthorizedException ||
            exception instanceof NotImplementedException ||
            exception instanceof CannotFindAvailabilityBody
        );
    }
}
