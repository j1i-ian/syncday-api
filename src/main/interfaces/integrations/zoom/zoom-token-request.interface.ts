export interface ZoomTokenRequestDTO {
    code: string;
    account_id: string;
    grant_type: string;
    redirect_uri: string;
    code_verifier: string;
    device_code: string;
}
