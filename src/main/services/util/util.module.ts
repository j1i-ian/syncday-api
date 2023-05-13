import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsSdkModule, AwsService, AwsServiceType } from 'nest-aws-sdk';
import { S3 } from '@aws-sdk/client-s3';
import { UtilService } from './util.service';
import { FileUtilsService } from './file-utils/file-utils.service';

@Global()
@Module({
    imports: [ConfigModule, AwsSdkModule.forFeatures([S3 as AwsServiceType<AwsService>])],
    providers: [UtilService, FileUtilsService],
    exports: [UtilService, FileUtilsService]
})
export class UtilModule {}
