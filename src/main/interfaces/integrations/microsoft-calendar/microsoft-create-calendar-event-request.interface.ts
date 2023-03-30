/**
 * Event creation request DTO
 * [Docs]{@link https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0&tabs=http}
 */
export interface MicrosoftCreateCalendarEventRequestDTO {
    subject: string;
    start: {
        dateTime: string;
        timeZone: string;
    };
    end: {
        dateTime: string;
        timeZone: string;
    };
    body?: {
        contentType: string;
        content: string;
    };

    attendees?: Array<{
        emailAddress: {
            address: string;
            name: string;
        };
        type: 'required' | 'optional' | 'resource';
    }>;
    location?: {
        displayName: string;
        address?: {
            street: string;
            city: string;
            state: string;
            countryOrRegion: string;
            postalCode: string;
        };
        locationType?: string;
    };
    allowNewTimeProposals?: true;
    reminderMinutesBeforeStart?: number;
}
