import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';

export interface SyncdayOAuth2TokenResponse {
    issuedToken: CreateTokenResponseDto;
    isNewbie: boolean;
    insufficientPermission: boolean;
}
