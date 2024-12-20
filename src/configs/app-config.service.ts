import * as winston from 'winston';
import * as WinstonCloudwatch from 'winston-cloudwatch';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModuleAsyncOptions, JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModuleAsyncOptions, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { WinstonModuleAsyncOptions } from 'nest-winston';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';


import { BadRequestException } from '@nestjs/common';
import { CloudWatchLogs, CloudWatchLogsClientConfig } from '@aws-sdk/client-cloudwatch-logs';
import { S3ClientConfig } from '@aws-sdk/client-s3';
import { SNSClientConfig } from '@aws-sdk/client-sns';
import { GoogleCredentials } from '@core/interfaces/integrations/google/google-credential.interface';
import { OAuth2Setting } from '@core/interfaces/auth/oauth2-setting.interface';
import * as ormConfig from '@config/ormconfig.json';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ClusterModuleAsyncOptions } from '@liaoliaots/nestjs-redis';

import { NodeEnv } from './node-env.enum';
import { ZoomBasicAuth } from '../main/interfaces/zoom-basic-auth.interface';

export class AppConfigService {

    static INTEGRATION_MAX_ADD_LIMIT = 6;

    static getPaypalSetting(
        configService: ConfigService
    ): { clientId: string; secret: string; hostUrl: string } {

        const clientIdKey = 'PAYPAL_CLIENT_ID';
        const secretKey = 'PAYPAL_SECRET';
        const hostUrlKey = 'PAYPAL_HOST_URL';

        return {
            clientId: configService.getOrThrow(clientIdKey),
            secret: configService.getOrThrow(secretKey),
            hostUrl: configService.getOrThrow(hostUrlKey)
        };
    }

    static getOAuth2Setting(
        integrationVendor: IntegrationVendor,
        configService: ConfigService
    ): OAuth2Setting {

        let oauth2SettingKeys: Record<keyof OAuth2Setting, string>;

        switch (integrationVendor) {
            case IntegrationVendor.GOOGLE:
                oauth2SettingKeys = {
                    redirectURI: 'GOOGLE_REDIRECT_URI',
                    clientId: 'GOOGLE_CLIENT_ID',
                    clientSecret: 'GOOGLE_CLIENT_SECRET',
                    oauth2SuccessRedirectURI: 'GOOGLE_OAUTH2_SUCCESS_REDIRECT_URI'
                };
                break;
            case IntegrationVendor.KAKAOTALK:
                oauth2SettingKeys = {
                    redirectURI: 'KAKAOTALK_REDIRECT_URI',
                    clientId: 'KAKAOTALK_CLIENT_ID',
                    clientSecret: '',
                    oauth2SuccessRedirectURI: 'KAKAOTALK_OAUTH2_SUCCESS_REDIRECT_URI'
                };
                break;
            default:
                throw new BadRequestException('Unsupported integration vendor');
        }

        const redirectURI = configService.getOrThrow<string>(oauth2SettingKeys.redirectURI);
        const clientId = configService.getOrThrow<string>(oauth2SettingKeys.clientId);
        const clientSecret = configService.get<string>(oauth2SettingKeys.clientSecret);
        const oauth2SuccessRedirectURI = configService.getOrThrow<string>(
            oauth2SettingKeys.oauth2SuccessRedirectURI
        );

        return {
            redirectURI,
            clientId,
            clientSecret,
            oauth2SuccessRedirectURI
        };
    }

    static getCorsSettingByEnv(): string[] {
        let origin = [
            'https://dev.sync.day',
            'https://stg.sync.day',
            'https://www.sync.day',
            'https://sync.day'
        ];

        if (process.env.ENV === NodeEnv.PRODUCTION) {
            origin = ['https://www.sync.day', 'https://sync.day'];
        }

        return origin;
    }

    static getHost(): string {

        let host = '';
        switch (process.env.ENV) {
            case NodeEnv.PRODUCTION:
                host = 'https://api.sync.day';
                break;
            case NodeEnv.STAGING:
                host = 'https://api.stg.sync.day';
                break;
            case NodeEnv.DEVELOP:
                host = 'https://api.dev.sync.day';
                break;
            default:
                host = process.env.HOST as string;
                break;
        }

        return host;
    }

    static getFrontendHost(): string {

        let frontendHost = '';
        switch (process.env.ENV) {
            case NodeEnv.PRODUCTION:
                frontendHost = 'https://sync.day';
                break;
            case NodeEnv.STAGING:
                frontendHost = 'https://stg.sync.day';
                break;
            case NodeEnv.DEVELOP:
                frontendHost = 'https://dev.sync.day';
                break;
            default:
                frontendHost = process.env.HOST as string;
                break;
        }

        return frontendHost;
    }

    static getBootpaySetting(
        configService: ConfigService
    ): { clientId: string; clientSecret: string } {
        return {
            clientId: configService.getOrThrow('BOOTPAY_CLIENT_ID'),
            clientSecret: configService.getOrThrow('BOOTPAY_CLIENT_SECRET')
        };
    }

    static getJwtModuleOptions(): JwtModuleAsyncOptions {
        return {
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => {
                const jwtOption = AppConfigService.getJwtOptions(configService);

                return jwtOption;
            },
            inject: [ConfigService]
        };
    }

    static getJwtOptions(configService: ConfigService): JwtModuleOptions {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        const expiresIn = configService.get<string>('JWT_EXPIRED_IN');

        return {
            secret: jwtSecret,
            signOptions: {
                expiresIn
            }
        };
    }

    static getJwtRefreshOptions(configService: ConfigService): JwtModuleOptions {
        const jwtSecret = configService.get<string>('JWT_REFRESH_SECRET');
        const expiresIn = configService.get<string>('JWT_REFRESH_EXPIRED_IN');

        return {
            secret: jwtSecret,
            signOptions: {
                expiresIn
            }
        };
    }

    static getDotenvConfigs(): string {
        const nodeEnv = process.env.ENV;

        let dotenvFilePath = '.env';

        switch (nodeEnv) {
            case NodeEnv.PRODUCTION:
                dotenvFilePath = '.env.production';
                break;
            case NodeEnv.DEVELOP:
                dotenvFilePath = '.env.dev';
                break;
            case NodeEnv.STAGING:
                dotenvFilePath = '.env.staging';
                break;
            case NodeEnv.LOCAL_PRODUCTION:
                dotenvFilePath = '.env.local.production';
                break;
            case NodeEnv.LOCAL_STAGING:
                dotenvFilePath = '.env.local.staging';
                break;
            case NodeEnv.LOCAL_DEVELOP:
                dotenvFilePath = '.env.local.dev';
                break;
            case NodeEnv.TEST:
                dotenvFilePath = '.env.test';
                break;
            case NodeEnv.INTEGRATION_TEST:
            case NodeEnv.LOCAL_INTEGRATION_TEST:
                dotenvFilePath = '.env.test.integration';
                break;
            case NodeEnv.LOCAL:
            default:
                dotenvFilePath = '.env.local';
                break;
        }
        return dotenvFilePath;
    }

    static getDatabaseConfigs(): TypeOrmModuleAsyncOptions {
        return {
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => {

                const env = configService.get<string>('ENV') as NodeEnv;

                switch (env) {
                    case NodeEnv.TEST:
                    case NodeEnv.INTEGRATION_TEST:
                    case NodeEnv.LOCAL_INTEGRATION_TEST:
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (ormConfig as any).entities = ormConfig.entities.map((_entityPath) => _entityPath.replace('dist', 'src'));
                        break;
                    default:
                        break;
                }

                return {
                    ...ormConfig,
                    host: configService.get<string>('MYSQL_HOST'),
                    username: configService.get<string>('MYSQL_USER'),
                    password: configService.get<string>('MYSQL_PASSWORD'),
                    database: configService.get<string>('MYSQL_DATABASE'),
                    synchronize: configService.get<string>('ORM_ENTITY_SYNC') === 'true',
                    logging: configService.get<string>('ORM_LOGGING') === 'true',
                    namingStrategy: new SnakeNamingStrategy()
                } as TypeOrmModuleOptions;
            },
            inject: [ConfigService]
        };
    }

    static getWinstonModuleSetting(): WinstonModuleAsyncOptions {
        return {
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const level = (configService.get<string>('LOG_LEVEL') as string) || 'debug';
                const env = process.env.ENV;

                let isLocal = false;

                switch (env) {
                    case NodeEnv.LOCAL:
                    case NodeEnv.LOCAL_DEVELOP:
                    case NodeEnv.LOCAL_STAGING:
                    case NodeEnv.LOCAL_PRODUCTION:
                    case NodeEnv.LOCAL_INTEGRATION_TEST:
                    case NodeEnv.TEST:
                        isLocal = true;
                        break;
                    default:
                        isLocal = false;
                        break;
                }

                const transports: winston.transport[] =
                    isLocal === false
                        ? [this._getWinstonModuleProductionTransports(configService)]
                        : [
                            new winston.transports.Console({
                                format: winston.format.json()
                            })
                        ];

                const winstonDefaultOption = {
                    level,
                    format: winston.format.json()
                };

                return {
                    ...winstonDefaultOption,
                    transports
                };
            }
        } as WinstonModuleAsyncOptions;
    }

    static getRedisModuleOptions(): ClusterModuleAsyncOptions {
        return {
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => {
                const redisHost = configService.get<string>('REDIS_HOST');
                let env = configService.get<string>('ENV') as NodeEnv;

                if (env === NodeEnv.LOCAL_DEVELOP) {
                    env = NodeEnv.DEVELOP;
                } else if (env === NodeEnv.LOCAL_STAGING) {
                    env = NodeEnv.STAGING;
                } else if (env === NodeEnv.LOCAL_PRODUCTION) {
                    env = NodeEnv.PRODUCTION;
                }

                return {
                    config: {
                        nodes: [{ host: redisHost, port: 6379 }],
                        clusterRetryStrategy: (times: number) => {
                            const delay = Math.min(100 + times * 2, 2000);
                            return delay;
                        },
                        enableReadyCheck: true,
                        keyPrefix: `${env}:`
                    }
                };
            },
            inject: [ConfigService]
        };
    }

    static getAwsS3ClientConfig(configService: ConfigService): S3ClientConfig {
        const region = configService.get<string>('AWS_REGION') as string;
        const accessKeyId = configService.get<string>('AWS_S3_ACCESS_KEY') as string;
        const secretAccessKey = configService.get<string>('AWS_S3_SECRET_KEY') as string;

        return {
            region,
            credentials: {
                accessKeyId,
                secretAccessKey
            }
        };
    }

    static getAwsSNSClientConfig(configService: ConfigService): SNSClientConfig {
        const region = configService.get<string>('AWS_REGION') as string;
        const accessKeyId = configService.get<string>('AWS_SNS_ACCESS_KEY') as string;
        const secretAccessKey = configService.get<string>('AWS_SNS_SECRET_KEY') as string;

        return {
            region,
            credentials: {
                accessKeyId,
                secretAccessKey
            }
        };
    }

    static getAwsS3BucketName(configSerivce: ConfigService): string {
        const awsS3BucketName = configSerivce.get<string>('AWS_S3_BUCKET_NAME') as string;
        return awsS3BucketName;
    }

    static getAwsSnsTopicARNSyncdayNotification(configService: ConfigService): string {
        const awsSnsTopicARNSyncdayNotification = configService.get<string>('AWS_SNS_TOPIC_ARN_SYNCDAY_NOTIFICATION') as string;
        return awsSnsTopicARNSyncdayNotification;
    }

    static getGoogleCredentials(configService: ConfigService): GoogleCredentials {
        return {
            clientId: configService.get<string>('GOOGLE_CLIENT_ID') as string,
            clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') as string
        };
    }

    static getBase64Encoded(id: string, password: string): string {

        const basicAuthIdPassword = `${id}:${password}`;
        const base64encoded = Buffer.from(basicAuthIdPassword).toString('base64');

        return base64encoded;
    }

    static getZoomCredentials(configService: ConfigService): ZoomBasicAuth {
        const zoomCredential: ZoomBasicAuth = {
            clientId: configService.get<string>('ZOOM_CLIENT_ID') as string,
            clientSecret: configService.get<string>('ZOOM_CLIENT_SECRET') as string
        };
        return zoomCredential;
    }

    static getZoomRedirectUri(configSerivce: ConfigService): string {
        const zoomRedirectURI = configSerivce.get<string>('ZOOM_REDIRECT_URI') as string;
        return zoomRedirectURI;
    }

    static getZoomOAuth2SuccessRedirectURI(configSerivce: ConfigService): string {
        const zoomOAuth2SuccessRedirectURI = configSerivce.get<string>('ZOOM_OAUTH2_SUCCESS_REDIRECT_URI') as string;
        return zoomOAuth2SuccessRedirectURI;
    }

    private static _getWinstonModuleProductionTransports(
        configService: ConfigService
    ): winston.transport {
        const level = (configService.get<string>('LOG_LEVEL') as string) || 'debug';

        const cloudwatchLogGroup = configService.get<string>('CLOUDWATCH_LOG_GROUP') as string;

        const yyyymmddHHmmss = AppConfigService.toYYYYMMDDHHmmss(new Date());
        const awsCredentialConfig = AppConfigService._getAWSCredentialConfig(configService);

        const cloudwatchLogStream = `${yyyymmddHHmmss}/${new Date().getTime()}`;

        return new WinstonCloudwatch({
            awsOptions: awsCredentialConfig,
            level,
            jsonMessage: true,
            cloudWatchLogs: new CloudWatchLogs(awsCredentialConfig),
            logGroupName: cloudwatchLogGroup,
            logStreamName: cloudwatchLogStream
        });
    }

    private static _getAWSCredentialConfig(
        configService: ConfigService
    ): CloudWatchLogsClientConfig {
        const region = configService.get<string>('AWS_REGION') as string;
        const accessKeyId = configService.get<string>('AWS_S3_ACCESS_KEY') as string;
        const secretAccessKey = configService.get<string>('AWS_S3_SECRET_KEY') as string;

        return {
            region,
            credentials: {
                accessKeyId,
                secretAccessKey
            }
        };
    }

    private static toYYYYMMDDHHmmss(target: Date, joiner = '-'): string {
        const YYYY = target.getFullYear();

        const _MM = target.getMonth() + 1;
        const MM = _MM < 10 ? `0${_MM}` : _MM;

        const _DD = target.getDate();
        const DD = _DD < 10 ? `0${_DD}` : _DD;

        const _HH = target.getHours();
        const HH = _HH < 10 ? `0${_HH}` : _HH;

        const _mm = target.getMinutes();
        const mm = _mm < 10 ? `0${_mm}` : _mm;

        const _ss = target.getSeconds();
        const ss = _ss < 10 ? `0${_ss}` : _ss;

        return [YYYY, MM, DD, HH, mm, ss].join(joiner);
    }
}
