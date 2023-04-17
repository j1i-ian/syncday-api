import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';
import { Verification } from '@entity/verifications/verification.entity';
import { EmailTemplate } from '@app/enums/email-template.enum';
import { Language } from '@app/enums/language.enum';
import { MailerService } from '@nestjs-modules/mailer';
import { FileUtilsService } from '../util/file-utils/file-utils.service';

/**
 * TODO: After the event-related entity is materialized, a method to search for the event-related email subject must be implemented.
 */
@Injectable()
export class IntegrationsService {
    constructor(
        private readonly configService: ConfigService,
        private readonly fileUtilService: FileUtilsService,
        private readonly mailerService: MailerService
    ) {}

    async sendVerificationEmail(verification: Verification, language: Language): Promise<boolean> {
        const templateSource = await this.fileUtilService.getEmailTemplate(
            EmailTemplate.VERIFICATION,
            language
        );
        const template = Handlebars.compile(templateSource);
        const compiledTemplate = template(verification);

        const subject = await this.fileUtilService.getEmailSubject(
            EmailTemplate.VERIFICATION,
            language
        );

        const sendMessageInfo = await this.sendEmail(verification.email, subject, compiledTemplate);
        return sendMessageInfo;
    }

    async sendEmail(reciever: string, subject: string, content: string): Promise<boolean> {
        const sentMessageInfo = await this.mailerService.sendMail({
            to: reciever,
            from: 'sync.day.official@gmail.com',
            subject,
            html: content
        });

        return !!sentMessageInfo;
    }
}
