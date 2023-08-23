import { GoogleAxiosErrorReasons } from '@app/interfaces/integrations/google/google-axios-error-reasons.enum';

export interface GoogleAxiosError {
    reason: GoogleAxiosErrorReasons;
}
