type Response =
    | 'none'
    | 'organizer'
    | 'tentativelyAccepted'
    | 'accepted'
    | 'declined'
    | 'notResponded';

/**
 * Event Generated Response DTO
 * [Docs]{@link https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0&tabs=http}
 */
export interface MicrosoftCreateCalendarEventResponseDTO {
    '@odata.context': string;
    id: string;
    createdDateTime: string;
    lastModifiedDateTime: string;
    changeKey: string;
    categories: string[];
    originalStartTimeZone: string;
    originalEndTimeZone: string;
    responseStatus: {
        response: Response;
        time: string;
    };
    iCalUId: string;
    reminderMinutesBeforeStart: number;
    isReminderOn: boolean;
    hasAttachments: boolean;
    subject: string;
    body: {
        contentType: string;
        content: string;
    };
    start: {
        dateTime: string;
        timeZone: string;
    };
    end: {
        dateTime: string;
        timeZone: string;
    };
    location: {
        displayName: string;
        locationType: string;
        uniqueId: string;
        address: {
            street: string;
            city: string;
            state: string;
            countryOrRegion: string;
            postalCode: string;
        };
        coordinates: {
            accuracy: number;
            altitude: number;
            altitudeAccuracy: number;
            latitude: number;
            longitude: number;
        };
    };
    type: string;
    seriesMasterId: string;
    attendees: Array<{
        type: 'required' | 'optional' | 'resource';
        status: {
            response: Response;
            time: string;
        };
        emailAddress: {
            name: string;
            address: string;
        };
    }>;
    organizer: {
        emailAddress: {
            name: string;
            address: string;
        };
    };
    webLink: string;
}
