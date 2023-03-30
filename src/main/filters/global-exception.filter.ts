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

        let message = exception.message;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const _responseMessages = (exception as any).response?.message;

        if (_responseMessages && Array.isArray(_responseMessages)) {
            message = _responseMessages.join('');
        }

        const status = (exception as HttpException).getStatus?.() || 500;

        const isInternalErrorMessage = this.isInternalErrorEnglishMessage(message);

        if (isInternalErrorMessage) {
            if (status / 100 === 5) {
                message = 'Server error happend.';
            } else if (exception instanceof UnauthorizedException) {
                message = 'Unauthoized Information.';
            }
        }

        this.logger.error(exception);

        response.status(status).json({
            statusCode: status,
            msg: message
        });
    }

    /**
     *
     * 전체 에러메시지의 한글 비율이 30% 미만일 경우 영어 에러 메시지로 간주한다.
     *
     * @param message 한글인지 영어인지 모를 에러메시지
     * @returns
     */
    isInternalErrorEnglishMessage(message: string | undefined): boolean {
        const requireHangulPercentage = 30;

        const isEnglishErrorMessage = message
            ? (message.replace(/[ㄱ-힣\s]*/g, '').length / message.length) * 100 >
              requireHangulPercentage
            : true;

        return isEnglishErrorMessage;
    }
}
