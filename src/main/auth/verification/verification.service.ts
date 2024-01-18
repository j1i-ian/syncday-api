import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { Cluster, RedisKey } from 'ioredis';
import { EmailTemplate } from '@core/interfaces/notifications/email-template.enum';
import { TextTemplate } from '@core/interfaces/notifications/text-template.enum';
import { SyncdayNotificationPublishKey } from '@core/interfaces/notifications/syncday-notification-publish-key.enum';
import { SyncdayAwsSnsRequest } from '@core/interfaces/notifications/syncday-aws-sns-request.interface';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { UtilService } from '@services/util/util.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { UserService } from '@services/users/user.service';
import { Verification } from '@entity/verifications/verification.interface';
import { CreateVerificationDto } from '@dto/verifications/create-verification.dto';
import { UpdatePhoneWithVerificationDto } from '@dto/verifications/update-phone-with-verification.dto';
import { Language } from '@app/enums/language.enum';
import { SyncdayNotificationPublishRequest } from '@app/interfaces/auth/verifications/syncday-notification-publish-request.interface';

@Injectable()
export class VerificationService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        private readonly utilService: UtilService,
        private readonly notificationsService: NotificationsService,

        // FIXME: we should implement a way for verification of user status with Redis
        @Inject(forwardRef(() => UserService))
        private readonly userService: UserService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    async createVerification(
        createVerificationDto: CreateVerificationDto,
        language: Language,
        isSignUpVerification: boolean
    ): Promise<boolean> {
        const { email, phoneNumber } = createVerificationDto;

        const digit = 4;
        const generatedVerificationCode = this.utilService.generateRandomNumberString(digit);
        const newVerificationParam: Verification = {
            verificationCode: generatedVerificationCode,
            ...createVerificationDto,
            uuid: createVerificationDto.uuid as string
        };

        let verificationRedisKey: RedisKey | null;

        if (email) {
            verificationRedisKey = this.syncdayRedisService.getEmailVerificationKey(email);
            const alreadySignedUpUser = await this.userService.findUserByLocalAuth(email);
            isSignUpVerification = !!alreadySignedUpUser;
        } else {
            verificationRedisKey = this.syncdayRedisService.getPhoneVerificationKey(phoneNumber as string);
            const alreadySignedUpUsers = await this.userService.search({ phone: phoneNumber });

            isSignUpVerification = !!alreadySignedUpUsers[0];
        }

        await this.publishSyncdayNotification(
            language,
            newVerificationParam,
            isSignUpVerification
        );

        // verification code is valid while 10 minutes
        const expire = 10 * 60;
        const _result = await this.cluster.setex(
            verificationRedisKey,
            expire,
            JSON.stringify(newVerificationParam)
        );

        const redisSetResult = _result === 'OK';

        return redisSetResult;
    }

    async update(updatePhoneWithVerificationDto: UpdatePhoneWithVerificationDto): Promise<boolean> {

        const { phone, verificationCode, uuid } = updatePhoneWithVerificationDto;

        const verificationRedisKey = this.syncdayRedisService.getPhoneVerificationKey(phone);
        const verificationJsonString = await this.cluster.get(verificationRedisKey);
        const verificationParam = JSON.parse(verificationJsonString as string) as Verification;

        const isVerificationCodeValid = verificationParam.verificationCode === verificationCode
            && verificationParam.uuid === uuid;

        let updateSuccess = false;

        if (isVerificationCodeValid) {
            await this.syncdayRedisService.setPhoneVerificationStatus(phone, uuid, true);

            updateSuccess = true;
        }

        return updateSuccess;
    }

    async publishSyncdayNotification(
        language: Language,
        newVerificationParam: Verification,
        isSignUpVerification: boolean
    ): Promise<boolean> {

        let notificationPublishParam: SyncdayNotificationPublishRequest
            = {} as SyncdayNotificationPublishRequest;

        if (newVerificationParam.email) {

            const defaultNotificationPublishParam = {
                notificationPublishKey: SyncdayNotificationPublishKey.EMAIL,
                verificationValue: newVerificationParam.email
            };

            if (isSignUpVerification) {
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

            const defaultNotificationPublishParam = {
                notificationPublishKey: SyncdayNotificationPublishKey.SMS_GLOBAL,
                verificationValue: newVerificationParam.phoneNumber as string
            };

            if (isSignUpVerification) {

                // TODO: The template type should be replaced with a guide for those who have already signed up
                notificationPublishParam = {
                    templateType: TextTemplate.VERIFICATION,
                    newVerification: null,
                    ...defaultNotificationPublishParam
                };
                newVerificationParam.verificationCode = '';
            } else {

                notificationPublishParam = {
                    templateType: TextTemplate.VERIFICATION,
                    newVerification: newVerificationParam,
                    ...defaultNotificationPublishParam
                };
            }
        }

        const jsonStringNewVerification = JSON.stringify(newVerificationParam);

        const notificationData = {
            template: notificationPublishParam.templateType,
            recipient: notificationPublishParam.verificationValue,
            language,
            data: jsonStringNewVerification
        } as SyncdayAwsSnsRequest;

        const publishResult = await this.notificationsService.sendMessage(
            notificationPublishParam.notificationPublishKey,
            notificationData
        );

        return publishResult;
    }

    validateCreateVerificationDto(
        createVerificationDto: CreateVerificationDto,
        userUUID?: string | null | undefined
    ): boolean {

        const { email, phoneNumber } = createVerificationDto;

        const isUUIDValid = userUUID ? true : !!createVerificationDto.uuid;

        const isValid = !!email || !!phoneNumber;

        return email
            ? isValid
            : isValid && isUUIDValid;
    }

    async isValidPhoneVerification(
        phone: string,
        verificationCode: string,
        uuid: string
    ): Promise<boolean> {
        const verificationOrNull = await this.syncdayRedisService.getPhoneVerification(phone);

        const isValidVerification = verificationOrNull &&
            verificationOrNull.verificationCode === verificationCode &&
            verificationOrNull.uuid === uuid;

        return !!isValidVerification;
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
