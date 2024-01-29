/**
 * microsoft token request interface
 * [Docs]{@link https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow}
 */
export interface MicrosoftTokenRequestDTO {
    grant_type: string;
    client_id: string;
    client_secret: string;
    scope: string;
    redirect_uri?: string;
    code?: string;
    refresh_token?: string;
    code_verifier?: string;
}
