import { OAuth2AccountUserProfileMetaInfo } from '@interfaces/integrations/oauth2-account-user-profile-meta-info.interface';
import { CreateUserWithOAuth2DTO } from '@interfaces/users/create-user-with-oauth2-dto.interface';

export interface OAuth2Converter {
    convertToCreateUserRequestDTO(
        timezone: string,
        oauth2AccountUserProfileMetaInfo: OAuth2AccountUserProfileMetaInfo
    ): CreateUserWithOAuth2DTO;
}
