import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { GlobalExceptionFilter } from '@app/filters/global-exception.filter';
import { InvalidICloudCredentialsException } from '@exceptions/integrations/calendar-integrations/invalid-icloud-credentials.exception';
import { InvalidICloudEmailException } from '@exceptions/integrations/calendar-integrations/invalid-icloud-email.exception';

@Catch()
export class AppleCalendarIntegrationsExceptionFilter extends GlobalExceptionFilter implements ExceptionFilter {
    static _instance: AppleCalendarIntegrationsExceptionFilter;

    constructor() {

        super();

        if (!AppleCalendarIntegrationsExceptionFilter._instance) {
            AppleCalendarIntegrationsExceptionFilter._instance = this;
        }

        return AppleCalendarIntegrationsExceptionFilter._instance;
    }

    catch(exception: Error | HttpException, host: ArgumentsHost): void {

        const { message } = exception;

        let fixedException: Error | HttpException;

        switch (message) {
            case 'Invalid credentials':
                fixedException = new InvalidICloudCredentialsException();
                break;
            case 'cannot find homeUrl':
                fixedException = new InvalidICloudEmailException();
                break;
            default:
                fixedException = exception;
                break;
        }

        super.catch(fixedException, host);
    }
}
