import { Injectable } from '@nestjs/common';
import { Cluster, RedisKey } from 'ioredis';
import { EmailTemplate } from '@core/interfaces/integrations/email-template.enum';
import { TextTemplate } from '@core/interfaces/integrations/text-template.enum';
import { SyncdayNotificationPublishKey } from '@core/interfaces/integrations/syncday-notification-publish-key.enum';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UtilService } from '@services/util/util.service';
import { IntegrationsService } from '@services/integrations/integrations.service';
import { Verification } from '@entity/verifications/verification.interface';
import { CreateVerificationDto } from '@dto/verifications/create-verification.dto';
import { Language } from '@app/enums/language.enum';

@Injectable()
export class VerificationService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        private readonly utilService: UtilService,
        private readonly integrationService: IntegrationsService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    async createVerification(
        createVerificationDto: CreateVerificationDto,
        language: Language
    ): Promise<boolean> {
        const { email, phoneNumber } = createVerificationDto;

        let notificationPublishParam: {
            verificationRedisKey: RedisKey;
            notificationPublishKey: SyncdayNotificationPublishKey;
            templateType: EmailTemplate | TextTemplate;
            newVerification: Verification;
            verificationValue: string;
        } = {} as {
            verificationRedisKey: RedisKey;
            notificationPublishKey: SyncdayNotificationPublishKey;
            templateType: EmailTemplate | TextTemplate;
            newVerification: Verification;
            verificationValue: string;
        };

        const digit = 4;
        const generatedVerificationCode = this.utilService.generateRandomNumberString(digit);
        const generatedUUID = this.utilService.generateUUID();

        const newVerificationParam: Verification = {
            uuid: generatedUUID,
            verificationCode: generatedVerificationCode
        };

        if (email) {
            newVerificationParam.email = email;
            notificationPublishParam = {
                verificationRedisKey: this.syncdayRedisService.getEmailVerificationKey(email),
                notificationPublishKey: SyncdayNotificationPublishKey.EMAIL,
                templateType: EmailTemplate.VERIFICATION,
                newVerification: newVerificationParam,
                verificationValue: email
            };

        } else {
            newVerificationParam.phoneNumber = phoneNumber;
            notificationPublishParam = {
                verificationRedisKey: this.syncdayRedisService.getPhoneVerificationKey(phoneNumber as string),
                notificationPublishKey: SyncdayNotificationPublishKey.SMS_GLOBAL,
                templateType: TextTemplate.VERIFICATION,
                newVerification: newVerificationParam,
                verificationValue: phoneNumber as string
            };
        }

        const jsonStringNewVerification = JSON.stringify(newVerificationParam);

        const publishResult = await this.integrationService.sendMessage(
            notificationPublishParam.notificationPublishKey,
            notificationPublishParam.templateType,
            notificationPublishParam.verificationValue,
            language,
            jsonStringNewVerification
        );

        // verification code is valid while 10 minutes
        const expire = 10 * 60;
        const _result = await this.cluster.setex(
            notificationPublishParam.verificationRedisKey,
            expire,
            jsonStringNewVerification
        );

        const redisSetResult = _result === 'OK';

        return publishResult && redisSetResult;
    }

    validateCreateVerificationDto(createVerificationDto: CreateVerificationDto): boolean {

        const { email, phoneNumber } = createVerificationDto;

        const isValid = !email && !phoneNumber;

        return isValid;
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
