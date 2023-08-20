import { Injectable } from '@nestjs/common';
import { Cluster } from 'ioredis';
import { EmailTemplate } from '@core/interfaces/integrations/email-template.enum';
import { TextTemplate } from '@core/interfaces/integrations/text-template.enum';
import { SyncdayNotificationPublishKey } from '@core/interfaces/integrations/syncday-notification-publish-key.enum';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UtilService } from '@services/util/util.service';
import { IntegrationsService } from '@services/integrations/integrations.service';
import { Verification } from '@entity/verifications/verification.interface';
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
        const jsonStringNewVerification = JSON.stringify(newVerification);

        await this.integrationService.sendMessage(
            SyncdayNotificationPublishKey.EMAIL,
            EmailTemplate.VERIFICATION,
            email,
            language,
            jsonStringNewVerification
        );

        // verification code is valid while 10 minutes
        const expire = 10 * 60;
        const result = await this.cluster.setex(
            emailKey,
            expire,
            JSON.stringify(newVerification)
        );

        return result === 'OK';
    }

    async createVerificationWithPhoneNumber(phoneNumber: string, language: Language): Promise<boolean>{
        const phoneKey = this.syncdayRedisService.getPhoneVerificationKey(phoneNumber);

        const digit = 4;
        const generatedVerificationCode = this.utilService.generateRandomNumberString(digit);

        const generatedUUID = this.utilService.generateUUID();
        const newVerification: Verification = {
            uuid: generatedUUID,
            phoneNumber,
            verificationCode: generatedVerificationCode
        };
        const jsonStringNewVerification = JSON.stringify(newVerification);

        await this.integrationService.sendMessage(
            SyncdayNotificationPublishKey.SMS_GLOBAL,
            TextTemplate.VERIFICATION,
            phoneNumber,
            language,
            jsonStringNewVerification
        );

        // verification code is valid while 10 minutes
        const expire = 10 * 60;
        const result = await this.cluster.setex(
            phoneKey,
            expire,
            JSON.stringify(newVerification)
        );

        return result === 'OK';
    }

    async isVerifiedPhone(phone: string): Promise<boolean> {
        const verificationOrNull = await this.syncdayRedisService.getPhoneVerification(phone);

        let isVerified = false;

        if (verificationOrNull) {
            isVerified = await this.syncdayRedisService.getPhoneVerificationStatus(
                phone,
                verificationOrNull.uuid
            );
        } else {
            isVerified = false;
        }

        return isVerified;
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
