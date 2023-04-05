import { IsDefined } from 'class-validator';

export class CreateGoogleUserRequestDto {
    @IsDefined()
    redirectUrl: string;

    @IsDefined()
    googleAuthCode: string;

    @IsDefined()
    timeZone: string;
}

export interface CreateGoogleUserRequest {
    redirectUrl: string;
    googleAuthCode: string;
    timeZone: string;
}
