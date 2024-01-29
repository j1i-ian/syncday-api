import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { OAuth2Type } from '@interfaces/oauth2-accounts/oauth2-type.enum';
import { OAuth2MetaInfo } from '@services/users/oauth2-metainfo.interface';
import { OAuth2UserProfile } from '@services/users/oauth2-user-profile.interface';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';

export interface CreateUserWithOAuth2DTO {
    oauth2Type: OAuth2Type;
    createUserRequestDto: CreateUserRequestDto;
    oauth2Token: OAuthToken;
    oauth2UserProfile: OAuth2UserProfile;
    integrationParams?: Partial<OAuth2MetaInfo>;
}
