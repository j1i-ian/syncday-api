import { BadRequestException, Injectable } from '@nestjs/common';
import { AwsService, AwsServiceType, InjectAwsService } from 'nest-aws-sdk';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommandInput, S3 } from '@aws-sdk/client-s3';
import { Language } from '@app/enums/language.enum';
import { EmailTemplate } from '@app/enums/email-template.enum';
import { UtilService } from '../util.service';

type EmailSubject = {
    [key in EmailTemplate]: string;
};

@Injectable()
export class FileUtilsService {
    constructor(
        private configService: ConfigService,
        private utilService: UtilService,
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        @InjectAwsService(S3 as AwsServiceType<AwsService>) private readonly s3: S3
    ) {
        this.__s3BucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') as string;
    }

    private __s3BucketName: string;

    async getEmailTemplate(emailTemplate: EmailTemplate, language: Language): Promise<string> {
        const assetFullPath = this.utilService.getMailAssetFullPath(emailTemplate, language);
        const params = {
            Bucket: this.__s3BucketName,
            Key: assetFullPath
        } as GetObjectCommandInput;

        const result = await this.s3.getObject(params);

        if (!result.Body) {
            throw new BadRequestException('Cannot found template type email');
        }

        const hbsBody = await result.Body.transformToString();

        return hbsBody;
    }

    async getEmailSubject(emailTemplate: EmailTemplate, language: Language): Promise<string> {
        const emailSubjectFullPath = this.utilService.getMailSubjectsJsonPath(language);
        const params = {
            Bucket: this.__s3BucketName,
            Key: emailSubjectFullPath
        } as GetObjectCommandInput;

        const result = await this.s3.getObject(params);

        if (!result.Body) {
            throw new BadRequestException('Cannot found template type email');
        }

        const transformedJsonString = await result.Body.transformToString();
        const emailSubjectJson: EmailSubject = JSON.parse(transformedJsonString);
        const emailSubject = emailSubjectJson[emailTemplate];
        return emailSubject;
    }
}
