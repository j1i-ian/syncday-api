import * as winston from 'winston';
import * as WinstonCloudwatch from 'winston-cloudwatch';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModuleAsyncOptions, JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModuleAsyncOptions, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { WinstonModuleAsyncOptions } from 'nest-winston';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import {
    AsyncModuleProvider,
    AwsService,
    AwsServiceConfigurationOptionsFactory,
    AwsServiceType,
    AwsServiceWithServiceOptions
} from 'nest-aws-sdk';
import { CloudWatchLogs, CloudWatchLogsClientConfig } from '@aws-sdk/client-cloudwatch-logs';
import * as ormConfig from '@config/ormconfig.json';
import { ClusterModuleAsyncOptions } from '@liaoliaots/nestjs-redis';

// eslint-disable-next-line import/no-internal-modules
import { MailerAsyncOptions } from '@nestjs-modules/mailer/dist/interfaces/mailer-async-options.interface';
import { MailerOptions } from '@nestjs-modules/mailer';
import { NodeEnv } from './node-env.enum';

interface AWSSDKOptionType {
    defaultServiceOptions?: AsyncModuleProvider<AwsServiceConfigurationOptionsFactory>;
    services?: Array<AwsServiceType<AwsService> | AwsServiceWithServiceOptions>;
}

export class AppConfigService {
    static getCorsSettingByEnv(): Array<string | RegExp> {
        let origin = [
            /((http|https):\/\/)?localhost:3000$/,
            /.*\.?dev.sync.day$/,
            /.*\.?stg.sync.day$/
        ];

        if (process.env.ENV === NodeEnv.PRODUCTION) {
            origin = [/.*\.?sync\.day$/];
        }

        return origin;
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

    static getDotenvConfigs(): string {
        const nodeEnv = process.env.ENV;

        let dotenvFilePath = '.env';

        switch (nodeEnv) {
            case 'production':
                dotenvFilePath = '.env.production';
                break;
            case 'development':
                dotenvFilePath = '.env.dev';
                break;
            case 'staging':
                dotenvFilePath = '.env.staging';
                break;
            default:
                dotenvFilePath = '.env.local';
                break;
        }
        return dotenvFilePath;
    }

    static getDatabaseConfigs(): TypeOrmModuleAsyncOptions {
        return {
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) =>
                ({
                    ...ormConfig,
                    host: configService.get<string>('MYSQL_HOST'),
                    username: configService.get<string>('MYSQL_USER'),
                    password: configService.get<string>('MYSQL_PASSWORD'),
                    database: configService.get<string>('MYSQL_DATABASE'),
                    synchronize: configService.get<string>('ORM_ENTITY_SYNC') === 'true',
                    logging: configService.get<string>('ORM_LOGGING') === 'true',
                    namingStrategy: new SnakeNamingStrategy()
                } as TypeOrmModuleOptions),
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

                const transports: winston.transport[] =
                    env === NodeEnv.PRODUCTION
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
                const env = configService.get<string>('ENV') as string;

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

    static getAWSSDKOptions(): AWSSDKOptionType {
        return {
            defaultServiceOptions: {
                imports: [ConfigModule],
                useFactory: (configService: ConfigService) => {
                    const region = configService.get<string>('AWS_REGION');
                    const accessKeyId = configService.get<string>('AWS_S3_ACCESS_KEY');
                    const secretAccessKey = configService.get<string>('AWS_S3_SECRET_KEY');

                    return {
                        credentials: {
                            accessKeyId,
                            secretAccessKey
                        },
                        region
                    } as AwsServiceConfigurationOptionsFactory;
                },
                inject: [ConfigService]
            }
        };
    }

    static getNodeMailerModuleOptions(): MailerAsyncOptions {
        return {
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => {
                const emailHost = 'smtp.gmail.com';
                const emailUser = configService.get<'string'>('EMAIL_USER');
                const emailUserPassword = configService.get<'string'>('EMAIL_USER_PASSWORD');

                return {
                    transport: {
                        host: emailHost,
                        port: 587,
                        secure: false,
                        auth: {
                            user: emailUser,
                            pass: emailUserPassword
                        }
                    },
                    defaults: {
                        from: {
                            name: 'Syncday',
                            address: emailUser
                        }
                    }
                } as MailerOptions;
            },
            inject: [ConfigService]
        };
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
