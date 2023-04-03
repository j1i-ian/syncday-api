import { Injectable } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UtilService } from '@services/util/util.service';
import { IntegrationsService } from '@services/integrations/integrations.service';
import { Verification } from '@entity/verifications/verification.entity';
import { Language } from '@app/enums/language.enum';
import { AppJwtPayload } from '../strategy/jwt/app-jwt-payload.interface';

@Injectable()
export class VerificationService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        private readonly utilService: UtilService,
        private readonly integrationService: IntegrationsService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    async createVerification({ email }: AppJwtPayload, language: Language): Promise<boolean> {
        const emailKey = this.syncdayRedisService.getEmailVerificationKey(email);

        const digit = 4;
        const generatedVerificationCode = this.utilService.generateRandomNumberString(digit);

        const newVerification: Verification = {
            email,
            verificationCode: generatedVerificationCode
        };

        await this.integrationService.sendVerificationEmail(newVerification, language);

        // verification code is valid while 10 minutes
        const expire = 60 * 10;
        const result = await this.cluster.set(
            emailKey,
            JSON.stringify(newVerification),
            'EX',
            expire
        );

        return result === 'OK';
    }

    async updateVerificationByEmail(email: string, verificationCode: string): Promise<boolean> {
        const verificationOrNull = await this.syncdayRedisService.getEmailVerification(email);

        return (
            verificationOrNull !== null && verificationOrNull.verificationCode === verificationCode
        );
    }
}
