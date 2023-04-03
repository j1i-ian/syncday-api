import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntegrationsService } from './integrations.service';

@Module({
    imports: [ConfigModule],
    providers: [IntegrationsService],
    exports: [IntegrationsService]
})
export class IntegrationsModule {}
