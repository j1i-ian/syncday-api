import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UtilService } from './util.service';
import { IntegrationUtilsService } from './integration-utils/integration-utils.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [UtilService, IntegrationUtilsService],
    exports: [UtilService, IntegrationUtilsService]
})
export class UtilModule {}
