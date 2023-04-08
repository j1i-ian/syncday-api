import { Language } from '@app/enums/language.enum';

/**
 * Temp user
 */
export class TemporaryUser {
    constructor(temporaryUser: Partial<TemporaryUser>) {
        Object.assign(this, temporaryUser);
    }

    email: string;
    plainPassword: string;
    nickname: string;

    language: Language;
}
