import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EmailTemplate } from '@app/enums/email-template.enum';
import { Language } from '@app/enums/language.enum';
import { User } from '../../../@core/core/entities/users/user.entity';
import { UserSetting } from '../../../@core/core/entities/users/user-setting.entity';
import { DateTimeOrderFormat } from '../../../@core/core/entities/users/date-time-format-order.enum';
import { DateTimeFormatOption } from '../../../@core/core/entities/users/date-time-format-option.type';
import { ZoomBasicAuth } from '../integrations/interfaces/zoom-basic-auth.interface';

interface UserDefaultSettingOption {
    randomSuffix: boolean;
    timezone?: string;
}

interface DefaultDateTimeFormat {
    dateTimeFormatOption: DateTimeFormatOption;
    dateTimeOrderFormat: DateTimeOrderFormat[];
}

@Injectable()
export class UtilService {
    generateUUID(): string {
        return uuidv4();
    }

    hash(plainText: string): string {
        const salt = bcrypt.genSaltSync(5);
        const hashedPassword = bcrypt.hashSync(plainText, salt);

        return hashedPassword;
    }

    generateRandomNumberString(digit: number, prefix = '0'): string {
        return String(Math.floor(Math.random() * Math.pow(10, digit))).padStart(digit, prefix);
    }

    getMailAssetFullPath(emailTemplate: EmailTemplate, language: Language): string {
        const hbsAssetPath = [emailTemplate, language, 'hbs'].join('.');
        const assetFullPath = ['assets', 'mails', hbsAssetPath].join('/');

        return assetFullPath;
    }

    getZoomBasicAuth(zoomBasicAuth: ZoomBasicAuth): string {
        const { clientId, clientSecret } = zoomBasicAuth;
        const basicAuthValue = clientId + ':' + clientSecret;
        return Buffer.from(basicAuthValue).toString('base64');
    }

    getMailSubjectsJsonPath(language: Language): string {
        const emailSubjectFileName = ['email-subjects', language, 'json'].join('.');
        const emailSubjectPath = ['assets', 'mails', emailSubjectFileName].join('/');

        return emailSubjectPath;
    }

    getUsetDefaultSetting(
        user: Partial<User>,
        language: Language,
        { randomSuffix, timezone }: UserDefaultSettingOption = {
            randomSuffix: false,
            timezone: undefined
        }
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

        const { dateTimeFormatOption, dateTimeOrderFormat } = this.getDefaultDateTimeFormat(
            language,
            timezone as string
        );

        return {
            workspace: workspaceName,
            preferredLanguage: language,
            preferredTimezone: timezone,
            preferredDateTimeOrderFormat: dateTimeOrderFormat,
            preferredDateTimeFormat: dateTimeFormatOption
        };
    }

    getDefaultDateTimeFormat(language: Language, timezone: string): DefaultDateTimeFormat {
        const formatter = new Intl.DateTimeFormat(language, {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const dateTimeFormatOrderType = ['year', 'month', 'day'];
        const dateTimeOrderFormat = formatter
            .formatToParts()
            .filter((formatPart) => dateTimeFormatOrderType.includes(formatPart.type))
            .map((formatPart) => formatPart.type) as DateTimeOrderFormat[];

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { locale, calendar, numberingSystem, timeZone, ...dateTimeFormatOption } =
            formatter.resolvedOptions();

        const dateTimeFomat: DefaultDateTimeFormat = {
            dateTimeFormatOption: dateTimeFormatOption as DateTimeFormatOption,
            dateTimeOrderFormat
        };
        return dateTimeFomat;
    }
}
