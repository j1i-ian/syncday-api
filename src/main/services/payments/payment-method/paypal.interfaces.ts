
export interface PayPalTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

export interface SubscriptionCheckResponse {
    status: string;
    reason?: string;
    subscription_id?: string;
}
