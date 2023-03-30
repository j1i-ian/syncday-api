/**
 * microsoft subscription creation API request interface
 * [Docs]{@link https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0&tabs=http}
 */
export interface MicrosoftCreateSubscriptionRequestDTO {
    changeType: string;
    notificationUrl: string;
    resource: string;
    expirationDateTime: string;
    clientState?: string;
    latestSupportedTlsVersion?: string;
}
