export interface AligoFailMessageResponseDTO {
    /**
     * Result code (API reception or not)
     */
    result_code: number;

    /**
     * Result message (if result_code is less than 0, indicate the reason for failure)
     */
    message: string;
}
