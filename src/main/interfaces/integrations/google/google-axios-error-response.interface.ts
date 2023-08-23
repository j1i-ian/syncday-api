import { GoogleAxiosError } from '@app/interfaces/integrations/google/google-axios-error.interface';

export interface GoogleAxiosErrorResponse {
    errors: GoogleAxiosError[];
}
