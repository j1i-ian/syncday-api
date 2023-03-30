import { AligoAlimInfo } from './interface/aligo-alim-info.interface';

export interface AligoSuccessAlimResponseDTO {
    /**
     * Result code (API reception or not)
     */
    code: number;

    /**
     * Result messages for API calls
     */
    message: string;

    /**
     * Remaining points and consumption unit price information after AlimTalk transmission
     */
    info: AligoAlimInfo;
}
