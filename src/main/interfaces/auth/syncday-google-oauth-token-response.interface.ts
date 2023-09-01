import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';

export interface SyncdayGoogleOAuthTokenResponse {
    issuedToken: CreateTokenResponseDto;
    isNewbie: boolean;
    insufficientPermission: boolean;
}
