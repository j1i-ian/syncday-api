import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Cluster, RedisKey } from 'ioredis';
import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { TextTemplate } from '@core/interfaces/notifications/text-template.enum';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UtilService } from '@services/util/util.service';
import { IntegrationsService } from '@services/integrations/integrations.service';
import { UserService } from '@services/users/user.service';
import { Verification } from '@entity/verifications/verification.interface';
import { CreateVerificationDto } from '@dto/verifications/create-verification.dto';
import { Language } from '@app/enums/language.enum';
import { SyncdayNotificationPublishRequest } from '@app/interfaces/auth/verifications/syncday-notification-publish-request.interface';

@Injectable()
export class VerificationService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        private readonly utilService: UtilService,
        private readonly integrationService: IntegrationsService,

        // FIXME: we should implement a way for verification of user status with Redis
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    async createVerification(
        createVerificationDto: CreateVerificationDto,
        language: Language
    ): Promise<boolean> {
        const { email, phoneNumber } = createVerificationDto;

        const digit = 4;
        const generatedVerificationCode = this.utilService.generateRandomNumberString(digit);
        const generatedUUID = this.utilService.generateUUID();
        const newVerificationParam: Verification = {
            uuid: generatedUUID,
            verificationCode: generatedVerificationCode,
            ...createVerificationDto
        };

        let verificationRedisKey: RedisKey | null;
        let isAlreadySignedUpUserOnEmailVerification = false;

        if (email) {
            verificationRedisKey = this.syncdayRedisService.getEmailVerificationKey(email);
            const alreadySignedUpUser = await this.userService.findUserByEmail(email);
            isAlreadySignedUpUserOnEmailVerification = !!alreadySignedUpUser;
        } else {
            verificationRedisKey = this.syncdayRedisService.getPhoneVerificationKey(phoneNumber as string);
            isAlreadySignedUpUserOnEmailVerification = false;
        }

        const publishResult = await this.publishSyncdayNotification(
            language,
            newVerificationParam,
            isAlreadySignedUpUserOnEmailVerification
        );

        // verification code is valid while 10 minutes
        const expire = 10 * 60;
        const _result = await this.cluster.setex(
            verificationRedisKey,
            expire,
            JSON.stringify(newVerificationParam)
        );

        const redisSetResult = _result === 'OK';

        return publishResult && redisSetResult;
    }

    async publishSyncdayNotification(
        language: Language,
        newVerificationParam: Pick<Verification, 'email' | 'phoneNumber'>,
        isAlreadySignedUpUserOnEmailVerification: boolean
    ): Promise<boolean> {

        let notificationPublishParam: SyncdayNotificationPublishRequest
            = {} as SyncdayNotificationPublishRequest;

        if (newVerificationParam.email) {

            const defaultNotificationPublishParam = {
                notificationPublishKey: SyncdayNotificationPublishKey.EMAIL,
                verificationValue: newVerificationParam.email
            };

            if (isAlreadySignedUpUserOnEmailVerification) {
                notificationPublishParam = {
                    templateType: EmailTemplate.ALREADY_SIGNED_UP,
                    newVerification: null,
                    ...defaultNotificationPublishParam
                };
            } else {
                notificationPublishParam = {
                    templateType: EmailTemplate.VERIFICATION,
                    newVerification: newVerificationParam,
                    ...defaultNotificationPublishParam
                };
            }

        } else {

            notificationPublishParam = {
                notificationPublishKey: SyncdayNotificationPublishKey.SMS_GLOBAL,
                templateType: TextTemplate.VERIFICATION,
                newVerification: newVerificationParam,
                verificationValue: newVerificationParam.phoneNumber as string
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

        return publishResult;
    }

    validateCreateVerificationDto(createVerificationDto: CreateVerificationDto): boolean {

        const { email, phoneNumber } = createVerificationDto;

        const isValid = !!email || !!phoneNumber;

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
