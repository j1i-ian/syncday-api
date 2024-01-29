export interface SlackSendMessageResponseDTO {
    ok: boolean;
    error?: string;
    response_metadata?: {
        messages?: string[];
    };
}
