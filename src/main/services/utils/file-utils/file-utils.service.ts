import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { AppConfigService } from '@configs/app-config.service';
import { SyncdayAwsSdkClientService } from '@services/utils/syncday-aws-sdk-clients/syncday-aws-sdk-client.service';
import { UtilService } from '@services/utils/util.service';

@Injectable()
export class FileUtilsService {
    constructor(
        private configService: ConfigService,
        private utilService: UtilService,
        private readonly syncdayAwsSdkClientService: SyncdayAwsSdkClientService
    ) {
        this._s3ImageBucketName = AppConfigService.getAwsS3BucketName(this.configService);
    }

    private _s3ImageBucketName: string;

    async issuePresignedUrl(inputFilename: string, prefix = 'images'): Promise<string> {
        const fileFullPath = this.utilService.generateFilePath(inputFilename, prefix);

        const command = new PutObjectCommand({
            Bucket: this._s3ImageBucketName,
            Key: fileFullPath
        });

        const presignedUrl = await getSignedUrl(this.syncdayAwsSdkClientService.getS3Client(), command, {
            expiresIn: 60
        });

        return presignedUrl;
    }
}
