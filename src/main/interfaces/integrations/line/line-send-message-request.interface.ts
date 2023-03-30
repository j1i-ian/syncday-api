export interface LineSendMessageRequestDTO {
    /**
     * Message (up to 1000 characters)
     */
    message: number;

    /**
     * Thumbnail image (up to 240 X 240px) url
     */
    imageThumbnail?: string;

    /**
     * Real image (up to 2048 X 2048px) url
     */
    imageFullsize?: string;

    /**
     * package ID
     */
    stickerPackageld?: number;

    /**
     * sticker ID
     */
    stickerId?: number;

    /**
     * Whether or not to receive user notifications
     * true -> user received
     * false -> User not received
     */
    notificationDisabled?: boolean;
}
