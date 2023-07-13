import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileUtilsService } from '@services/util/file-utils/file-utils.service';
import { UtilController } from '@services/util/util.controller';
import { UtilService } from './util.service';
import { IntegrationUtilsService } from './integration-utils/integration-utils.service';

@Global()
@Module({
    imports: [ConfigModule],
    controllers: [UtilController],
    providers: [UtilService, IntegrationUtilsService, FileUtilsService],
    exports: [UtilService, IntegrationUtilsService, FileUtilsService]
})
export class UtilModule {}
