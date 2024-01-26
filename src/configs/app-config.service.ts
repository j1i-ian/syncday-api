import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { S3ClientConfig } from '@aws-sdk/client-s3';
import { SNSClientConfig } from '@aws-sdk/client-sns';
import * as ormConfig from '@configs/ormconfig.json';
import { ResourceConfigService } from '@configs/resource-config.service';
import { NodeEnv } from '@interfaces/node-env.enum';

export class AppConfigService extends ResourceConfigService {

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

                const loggingSettingString = configService.get<string>('ORM_LOGGING');

                let logging: string[] | boolean;

                if (loggingSettingString === 'true') {
                    logging = true;
                } else if (loggingSettingString === 'false') {
                    logging = false;
                } else {
                    logging = [loggingSettingString] as string[];
                }

                return {
                    ...ormConfig,
                    host: configService.get<string>('MYSQL_HOST'),
                    username: configService.get<string>('MYSQL_USER'),
                    password: configService.get<string>('MYSQL_PASSWORD'),
                    database: configService.get<string>('MYSQL_DATABASE'),
                    synchronize: configService.get<string>('ORM_ENTITY_SYNC') === 'true',
                    logging,
                    namingStrategy: new SnakeNamingStrategy()
                } as TypeOrmModuleOptions;
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

}
