import { Injectable } from '@nestjs/common';
import { EmailTemplate } from '@app/enums/email-template.enum';
import { Language } from '@app/enums/language.enum';

@Injectable()
export class UtilService {
    generateRandomNumberString(digit: number, prefix = '0'): string {
        return String(Math.floor(Math.random() * Math.pow(10, digit))).padStart(digit, prefix);
    }

    getAssetFullPath(emailTemplate: EmailTemplate, language: Language): string {
        const hbsAssetPath = [emailTemplate, language, 'hbs'].join('.');
        const assetFullPath = ['assets', 'mails', hbsAssetPath].join('/');

        return assetFullPath;
    }
}
