import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileUtilsService } from '@services/util/file-utils/file-utils.service';
import { UtilController } from '@services/util/util.controller';
import { SHARE_TIME_UTIL_SERVICE_PROVIDER } from '@services/util/share-time-util-service-provider.token';
import { InternalShareTimeUtilService } from '@services/util/internal-share-time-util.service';
import { UtilService } from './util.service';
import { IntegrationUtilsService } from './integration-utils/integration-utils.service';
import { TimeUtilService } from './time-util/time-util.service';

@Global()
@Module({
    imports: [ConfigModule],
    controllers: [UtilController],
    providers: [
        UtilService,
        IntegrationUtilsService,
        FileUtilsService,
        TimeUtilService,
        {
            provide: SHARE_TIME_UTIL_SERVICE_PROVIDER,
            useClass: InternalShareTimeUtilService
        }
    ],
    exports: [
        UtilService,
        IntegrationUtilsService,
        FileUtilsService,
        TimeUtilService,
        {
            provide: SHARE_TIME_UTIL_SERVICE_PROVIDER,
            useClass: InternalShareTimeUtilService
        }
    ]
})
export class UtilModule {}
