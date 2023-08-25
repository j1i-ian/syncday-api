import { Module, forwardRef } from '@nestjs/common';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { IntegrationsModule } from '@services/integrations/integrations.module';
import { UserModule } from '@services/users/user.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
    imports: [SyncdayRedisModule, IntegrationsModule, forwardRef(() => UserModule)],
    controllers: [VerificationController],
    providers: [VerificationService],
    exports: [VerificationService]
})
export class VerificationModule {}
