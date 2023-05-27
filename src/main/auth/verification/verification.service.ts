import { Injectable } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UtilService } from '@services/util/util.service';
import { IntegrationsService } from '@services/integrations/integrations.service';
import { Verification } from '@entity/verifications/verification.entity';
import { Language } from '@app/enums/language.enum';

@Injectable()
export class VerificationService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        private readonly utilService: UtilService,
        private readonly integrationService: IntegrationsService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    async createVerification(email: string, language: Language): Promise<boolean> {
        const emailKey = this.syncdayRedisService.getEmailVerificationKey(email);

        const digit = 4;
        const generatedVerificationCode = this.utilService.generateRandomNumberString(digit);

        const generatedUUID = this.utilService.generateUUID();
        const newVerification: Verification = {
            uuid: generatedUUID,
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

    async isVerifiedUser(email: string): Promise<boolean> {
        const verificationOrNull = await this.syncdayRedisService.getEmailVerification(email);

        let isVerified = false;

        if (verificationOrNull) {
            isVerified = await this.syncdayRedisService.getEmailVerificationStatus(
                email,
                verificationOrNull.uuid
            );
        } else {
            isVerified = false;
        }

        return isVerified;
    }
}
