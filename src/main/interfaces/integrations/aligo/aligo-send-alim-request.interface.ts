export interface AligoSendAlimRequestDTO {
    /**
     * API Key for Authentication
     */
    apikey: string;

    /**
     * userid
     */
    userid: string;

    /**
     * Generated Token
     */
    token: string;

    /**
     * outgoing profile key
     */
    senderkey: string;

    /**
     * template code
     */
    tpl_code: string;

    /**
     * sender contact
     */
    sender: string;

    /**
     * reservation date
     */
    senddate: Date;

    /**
     * 1 to 500 possible
     */
    receiver_1: string;

    /**
     * Recipient name 1 to 500 possible
     */
    recvname_1: string;

    /**
     * AlimTalk Titles 1 to 500 are available
     */
    subject_1: string;
    /**
     * 1 to 500 contents of AlimTalk are available
     */
    message_1: string;

    /**
     * Highlighted title, 1 to 500 possible
     */
    emtitle_1?: string;

    /**
     * Button information, available from 1 to 500
     */
    button_1?: string;

    /**
     * Substitution text transmission function in case of failure (Y or N)
     */
    failover: 'Y' | 'N';

    /**
     * In case of failure, alternate text titles 1 to 500 are available
     */
    fsubject_1: string;

    /**
     * In case of failure, alternative character content is available from 1 to 500
     */
    fmessage_1: string;

    /**
     * Whether test mode is applied (Y or N)
     */
    testMode: 'Y' | 'N';
}
