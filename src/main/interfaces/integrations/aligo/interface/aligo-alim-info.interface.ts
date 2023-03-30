export interface AligoAlimInfo {
    /**
     * AT
     */
    type: string;

    /**
     * Message ID
     */
    mid: string;

    /**
     * point
     */
    current: number;

    /**
     * Individual transmission unit price
     */
    unit: number;

    /**
     * Total transmission unit price
     */
    total: number;

    /**
     * Number of normally requested contacts
     */
    scnt: number;

    /**
     * Number of incorrectly requested contacts
     */
    fcnt: number;
}
