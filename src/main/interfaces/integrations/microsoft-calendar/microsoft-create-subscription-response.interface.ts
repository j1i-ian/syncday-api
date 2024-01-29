/**
 * microsoft subscription creation API response interface
 * [Docs]{@link https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0&tabs=http}
 */
export interface MicrosoftCreateSubscriptionResponseDTO {
    id: string;
    expirationDateTime: string;
    resource: string;
    applicationId: string;
    changeType: string;
    clientState?: string;
    notificationUrl: string;
    creatorId: string;
    latestSupportedTlsVersion?: string;
}
