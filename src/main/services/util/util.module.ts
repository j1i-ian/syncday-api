import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UtilService } from './util.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [UtilService],
    exports: [UtilService]
})
export class UtilModule {}
