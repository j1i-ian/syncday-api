/**
 * microsoft token response interface
 * [Docs]{@link https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow}
 */
export interface MicrosoftTokenResponseDTO {
    token_type: string;
    expires_in: number;
    access_token: string;
    refresh_token: string;
    scope: string;
    id_token?: string;
}
