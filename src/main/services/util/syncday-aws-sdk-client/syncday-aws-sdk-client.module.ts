import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SyncdayAwsSdkClientService } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [SyncdayAwsSdkClientService],
    exports: [SyncdayAwsSdkClientService]
})
export class SyncdayAwsSdkClientModule {}
