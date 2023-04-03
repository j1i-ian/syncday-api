import { Module } from '@nestjs/common';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { IntegrationsModule } from '@services/integrations/integrations.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
    imports: [SyncdayRedisModule, IntegrationsModule],
    controllers: [VerificationController],
    providers: [VerificationService]
})
export class VerificationModule {}
