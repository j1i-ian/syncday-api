export interface AligoSuccessMessageResponseDTO {
    /**
     * Result code (API reception or not)
     */
    result_code: number;

    /**
     * Result message (if result_code is less than 0, indicate the reason for failure)
     */
    message: string;

    /**
     * message unique ID
     */
    msg_id: number;

    /**
     * Number of successful requests
     */
    success_cnt: number;

    /**
     * Number of failed requests
     */
    error_cnt: number;

    /**
     * Message type (1. SMS, 2. LMS, 3. MMS)
     */
    msg_type: 'SMS' | 'LMS' | 'MMS';
}
