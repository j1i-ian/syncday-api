export interface AligoSendMessageRequestDTO {
    /**
     * API Key for Authentication
     */
    key: string;

    /**
     * user id
     */
    user_id: string;

    /**
     * Caller's phone number
     */
    sender: string;

    /**
     * Recipient's phone number - up to 1,000 by comma (,) branch input
     */
    receiver: string;

    /**
     * Message contents (1~2,000 bytes)
     */
    msg: string;

    /**
     * SMS (short text), LMS (long text), MMS (pictogram) classification
     */
    msg_type: string;

    /**
     * Text title (only LMS, MMS allowed)
     */
    title?: string;

    /**
     * Input for substitution of %customer name%
     */
    destination?: string;

    /**
     * Reservation date (more than the current date) ex) YYYYMMDD
     */
    rdate?: string;

    /**
     * Reservation time (after 10 minutes based on current time) ex) YYYYMMDD
     */
    rtime?: string;

    /**
     * Apply Y for interlocking test
     */
    testmode_yn: string;
}
