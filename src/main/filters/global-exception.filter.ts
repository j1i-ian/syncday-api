import {
    ArgumentsHost,
    BadRequestException,
    Catch,
    ConflictException,
    ExceptionFilter,
    HttpException,
    Inject,
    InternalServerErrorException,
    Logger,
    NotImplementedException,
    UnauthorizedException
} from '@nestjs/common';
import { Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { EntityNotFoundError } from 'typeorm';
import { CannotFindAvailabilityBody } from '@app/exceptions/availability/cannot-find-availability-body.exception';
import { AlreadyIntegratedCalendarException } from '@app/exceptions/integrations/already-integrated-calendar.exception';
import { InvalidICloudCredentialsException } from '@exceptions/integrations/calendar-integrations/invalid-icloud-credentials.exception';
import { InvalidICloudEmailException } from '@exceptions/integrations/calendar-integrations/invalid-icloud-email.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    static _instance: GlobalExceptionFilter;

    constructor() {
        if (!GlobalExceptionFilter._instance) {
            GlobalExceptionFilter._instance = this;
        }
        return GlobalExceptionFilter._instance;
    }

    @Inject(WINSTON_MODULE_PROVIDER) protected readonly logger: Logger;

    catch(exception: Error | EntityNotFoundError | HttpException, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let message = (exception as any).response?.message;
        let exceptionType = InternalServerErrorException.name;

        const status = (exception as HttpException).getStatus?.() || 500;

        if (this.isWhiteListedException(exception as HttpException)) {
            exceptionType = exception.name;
            message = exception.message || 'Unauthoized Information.';
        } else if (status / 100 === 5) {
            message = 'Server error happend.';
        } else {
            message = message;
        }

        this.logger.error({
            message: exception.message,
            stack: exception.stack,
            name: exception.name
        });

        response.status(status).json({
            statusCode: status,
            exception: exceptionType,
            message
        });
    }

    isWhiteListedException(exception: HttpException): boolean {
        return (
            exception instanceof BadRequestException ||
            exception instanceof UnauthorizedException ||
            exception instanceof ConflictException ||
            exception instanceof NotImplementedException ||
            exception instanceof CannotFindAvailabilityBody ||
            exception instanceof AlreadyIntegratedCalendarException ||
            exception instanceof InvalidICloudCredentialsException ||
            exception instanceof InvalidICloudEmailException
        );
    }
}
