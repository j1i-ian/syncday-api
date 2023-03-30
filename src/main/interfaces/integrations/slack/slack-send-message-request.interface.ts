/**
 * [Docs]{@link https://api.slack.com/messaging/webhooks}based on
 */
export interface SlackSendMessageRequestDTO {
    blocks: SlackBlock[]; // array of block elements
    text?: string; // separate text
}
export interface SlackBlock {
    type: string;
    text?: {
        type: string;
        text: string;
        emoji?: boolean;
    };
    elements?: Array<{
        type: string;
        text: string;
        emoji?: boolean;
    }>;
    block_id?: string;
    accessory?: {
        type: string;
        text: {
            type: string;
            text: string;
            emoji?: boolean;
        };
        value?: string;
        url?: string;
        action_id?: string;
    };
    fields?: Array<{
        type: string;
        text: string;
        emoji?: boolean;
    }>;
    image_url?: string;
    alt_text?: string;
    title?: {
        type: string;
        text: string;
        emoji?: boolean;
    };
    image_width?: number;
    image_height?: number;
    image_bytes?: number;
}
