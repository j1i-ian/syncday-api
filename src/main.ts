import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { urlencoded, json } from 'body-parser';
import helmet from 'helmet';
import { Logger, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';
import { AppConfigService } from '@config/app-config.service';
import { AppModule } from './app.module';

const PORT = 3011;
const ENV = process.env.ENV ?? 'unknown';

const logger = new Logger('App');

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);

    const origin = AppConfigService.getCorsSettingByEnv();

    app.use(helmet());
    app.enableCors({
        origin,
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'COPY', 'LINK', 'UNLINK'],
        preflightContinue: false,
        optionsSuccessStatus: 204
    });

    app.enableShutdownHooks();

    app.use(urlencoded({ limit: '20MB', extended: true }));
    app.use(json({ limit: '20MB' }));

    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: [VERSION_NEUTRAL, '1']
    });

    await app.listen(PORT, () => {
        logger.log(`Server is started with port ${PORT} on ${ENV} ✨`);
    });
}

bootstrap();
