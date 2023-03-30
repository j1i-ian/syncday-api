export interface AligoSuccessTokenResponseDTO {
    /**
     * 0 on success, -99 on failure
     */
    code: number;

    /**
     * This is the result message corresponding to the code value.
     */
    message: string;

    /**
     * The generated TOKEN string is returned.
     */
    token: string;

    /**
     * URL encoding is applied to the generated TOKEN string and returned.
     */
    urlencode: string;
}
