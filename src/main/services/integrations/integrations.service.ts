import { Injectable } from '@nestjs/common';
import Handlebars from 'handlebars';
import { ConfigService } from '@nestjs/config';
import { Verification } from '@entity/verifications/verification.entity';
import { EmailTemplate } from '@app/enums/email-template.enum';
import { Language } from '@app/enums/language.enum';
import { MailerService } from '@nestjs-modules/mailer';
import { FileUtilsService } from '../util/file-utils/file-utils.service';

@Injectable()
export class IntegrationsService {
    constructor(
        private readonly configService: ConfigService,
        private readonly fileUtilService: FileUtilsService,
        private readonly mailerService: MailerService
    ) {}

    async sendVerificationEmail(verification: Verification, language: Language): Promise<boolean> {
        const source = await this.fileUtilService.getEmailTemplate(
            EmailTemplate.VERIFICATION,
            language
        );

        const template = Handlebars.compile(source);

        const compiled = template(verification);

        const sentMessageInfo = await this.mailerService.sendMail({
            to: verification.email,
            from: 'sync.day.official@gmail.com',
            subject: 'Verification Email',
            html: compiled
        });

        return !!sentMessageInfo;
    }

    async sendEmail(): Promise<void> {}
}
