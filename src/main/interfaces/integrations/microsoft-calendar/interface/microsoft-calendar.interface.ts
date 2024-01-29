export interface MicrosoftCalendar {
    '@odata.id': string;
    id: string;
    name: string;
    color: string;
    changeKey: string;
    canShare: boolean;
    canViewPrivateItems: boolean;
    hexColor: string;
    canEdit: boolean;
    allowedOnlineMeetingProviders: string[];
    defaultOnlineMeetingProvider: string;
    isTallyingResponses: boolean;
    isRemovable: boolean;
    owner: {
        name: string;
        address: string;
    };
}
