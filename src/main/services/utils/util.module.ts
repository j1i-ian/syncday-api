import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreUtilModule } from '@services/utils/core-util.module';
import { FileUtilsService } from '@services/utils/file-utils/file-utils.service';
import { UtilController } from '@services/utils/util.controller';
import { TimeUtilService } from '@services/utils/time-util.service';
import { UtilService } from './util.service';
import { IntegrationUtilsService } from './integration-utils/integration-utils.service';

@Global()
@Module({
    imports: [ConfigModule, CoreUtilModule],
    controllers: [UtilController],
    providers: [UtilService, TimeUtilService, IntegrationUtilsService, FileUtilsService],
    exports: [UtilService, TimeUtilService, IntegrationUtilsService, FileUtilsService]
})
export class UtilModule {}
