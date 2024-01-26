import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SyncdayAwsSdkClientService } from '@services/utils/syncday-aws-sdk-clients/syncday-aws-sdk-client.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [SyncdayAwsSdkClientService],
    exports: [SyncdayAwsSdkClientService]
})
export class SyncdayAwsSdkClientModule {}
