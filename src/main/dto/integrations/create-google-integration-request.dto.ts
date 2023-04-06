import { IsString } from 'class-validator';

export class CreateGoogleIntegrationDto {
    @IsString()
    authorizationCode: string;

    @IsString()
    redirectUri: string;
}
