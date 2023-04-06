import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { EmailTemplate } from '@app/enums/email-template.enum';
import { Language } from '@app/enums/language.enum';
import { User } from '../../../@core/core/entities/users/user.entity';
import { UserSetting } from '../../../@core/core/entities/users/user-setting.entity';

interface UserDefaultSettingOption {
    randomSuffix: boolean;
}

@Injectable()
export class UtilService {
    generateUUID(): string {
        return uuidv4();
    }

    generateRandomNumberString(digit: number, prefix = '0'): string {
        return String(Math.floor(Math.random() * Math.pow(10, digit))).padStart(digit, prefix);
    }

    getAssetFullPath(emailTemplate: EmailTemplate, language: Language): string {
        const hbsAssetPath = [emailTemplate, language, 'hbs'].join('.');
        const assetFullPath = ['assets', 'mails', hbsAssetPath].join('/');

        return assetFullPath;
    }

    getUsetDefaultSetting(
        user: Partial<User>,
        language: Language,
        { randomSuffix }: UserDefaultSettingOption = { randomSuffix: false }
    ): Partial<UserSetting> {
        let workspaceName = '';

        if (user.nickname) {
            workspaceName = user.nickname;
        } else if (user.email) {
            const extractedWorkspaceNameFromEmail = user.email.split('@')[0];
            workspaceName = extractedWorkspaceNameFromEmail;
        } else {
            workspaceName = this.generateUUID();
        }

        if (randomSuffix) {
            const randomNumberString = this.generateRandomNumberString(4);
            workspaceName += randomNumberString;
        }

        return {
            link: workspaceName,
            preferredLanguage: language
        };
    }
}
