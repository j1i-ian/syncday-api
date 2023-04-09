import { IsDefined } from 'class-validator';

export class CreateGoogleUserRequestDto {
    @IsDefined()
    redirectUrl: string;

    @IsDefined()
    googleAuthCode: string;

    @IsDefined()
    timezone: string;
}

export interface CreateGoogleUserRequest {
    redirectUrl: string;
    googleAuthCode: string;
    timezone: string;
}
