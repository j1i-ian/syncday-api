import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient } from '@aws-sdk/client-sns';
import { S3Client } from '@aws-sdk/client-s3';
import { AppConfigService } from '@config/app-config.service';

@Injectable()
export class SyncdayAwsSdkClientService implements OnModuleInit {
    constructor(
        @Inject(ConfigService) private readonly configService: ConfigService
    ) {}

    private S3Client : S3Client;
    private SNSClient : SNSClient;

    onModuleInit(): void {
        const awsS3ClientConfig =  AppConfigService.getAwsS3ClientConfig(this.configService);
        const awsSNSClientConfig =  AppConfigService.getAwsSNSClientConfig(this.configService);

        this.S3Client = new S3Client(awsS3ClientConfig);
        this.SNSClient = new SNSClient(awsSNSClientConfig);
    }

    getS3Client(): S3Client {
        return this.S3Client;
    }

    getSNSClient(): SNSClient {
        return this.SNSClient;
    }
}
