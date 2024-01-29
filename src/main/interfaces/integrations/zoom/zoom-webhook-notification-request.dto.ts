export interface ZoomWebhookNotificationRequestDto {
    event: string;
    payload: {
        user_id: string;
        account_id: string;
        client_id: string;
        deauthorization_time: Date;
        signature: string;
    };
}
