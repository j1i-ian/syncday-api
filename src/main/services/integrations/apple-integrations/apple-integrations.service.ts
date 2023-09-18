/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { DAVClient, getBasicAuthHeaders } from 'tsdav';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IntegrationSchedulesService } from '@core/interfaces/integration-schedules.abstract-service';
import { IntegrationSearchOption } from '@interfaces/integrations/integration-search-option.interface';
import { AppleCalDAVCredential } from '@interfaces/integrations/apple/apple-cal-dav-credentials.interface';
import { IntegrationsFactory } from '@services/integrations/integrations.factory.interface';
import { AppleConverterService } from '@services/integrations/apple-integrations/apple-converter/apple-converter.service';
import { AppleIntegrationsSchedulesService } from '@services/integrations/apple-integrations/apple-integrations-schedules/apple-integrations-schedules.service';
import { IntegrationScheduleWrapperService } from '@services/integrations/integration-schedule-wrapper-service.interface';
import { Integration } from '@entity/integrations/integration.entity';
import { User } from '@entity/users/user.entity';
import { AppleCalDAVIntegration } from '@entity/integrations/apple/apple-caldav-integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { IntegrationResponseDto } from '@dto/integrations/integration-response.dto';
import { SyncdayGoogleOAuthTokenResponse } from '@app/interfaces/auth/syncday-google-oauth-token-response.interface';
import { AlreadyIntegratedCalendar } from '@app/exceptions/integrations/already-integrated-calendar.exception';

@Injectable()
export class AppleIntegrationsService implements IntegrationsFactory, IntegrationScheduleWrapperService {

    constructor(
        private readonly appleConverter: AppleConverterService,
        private readonly appleIntegrationsSchedulesService: AppleIntegrationsSchedulesService,
        @InjectRepository(AppleCalDAVIntegration)
        private readonly appleCalDAVIntegrationRepository: Repository<AppleCalDAVIntegration>
    ) {}

    generateOAuth2RedirectURI(_syncdayGoogleOAuthTokenResponseOrSyncdayAccessToken?: string | SyncdayGoogleOAuthTokenResponse | undefined): string {
        throw new Error('Method not implemented.');
    }

    search(userSearchOption: IntegrationSearchOption): Promise<Array<Integration | IntegrationResponseDto>> {
        throw new Error('Method not implemented.');
    }

    findOne(userSearchOption: IntegrationSearchOption): Promise<Integration | IntegrationResponseDto | null> {
        throw new Error('Method not implemented.');
    }

    async create(
        user: User,
        userSetting: UserSetting,
        appleCalDAVCredential: AppleCalDAVCredential,
        timezone: string
    ): Promise<Integration> {

        const icloudCalDAVUrl = this.icloudCalDAVUrl;
        const {
            username: appleId,
            password: appSpecificPassword
        } = appleCalDAVCredential;

        const credentials = {
            username: appleId,
            password: appSpecificPassword
        };

        const loadedAppleIntegration = await this.appleCalDAVIntegrationRepository.findOneBy({
            email: appleId,
            userId: user.id
        });

        if (loadedAppleIntegration) {
            throw new AlreadyIntegratedCalendar();
        }

        const client = new DAVClient({
            serverUrl: icloudCalDAVUrl,
            credentials,
            authMethod: 'Basic',
            defaultAccountType: 'caldav'
        });

        await client.login();

        const calendars = await client.fetchCalendars();

        const calDAVBasicHeaders = getBasicAuthHeaders(credentials);

        const today = new Date();
        const _3monthAfter = new Date(new Date().setMonth(today.getMonth() + 3));

        const convertedCalendars = await Promise.all(
            calendars
                // Filter events for users' calendar
                .filter((_webDAVCalendar) => _webDAVCalendar.components?.includes('VEVENT'))
                .map(async (_calendar) => {

                    const convertedAppleCalDAVCalndarIntegration = this.appleConverter.convertCalDAVCalendarToAppleCalendarIntegration(
                        timezone,
                        _calendar
                    );

                    const calDAVSchedules = await client.fetchCalendarObjects({
                        calendar: {
                            url: convertedAppleCalDAVCalndarIntegration.calDavUrl
                        },
                        expand: true,
                        timeRange: {
                            start: new Date().toISOString(),
                            end: _3monthAfter.toISOString()
                        },
                        headers: calDAVBasicHeaders
                    });

                    const convertedSchedules = calDAVSchedules.flatMap((calDAVSchedule) =>
                        this.appleConverter.convertCalDAVCalendarObjectsToAppleCalDAVIntegrationSchedules(
                            user.uuid,
                            userSetting.workspace,
                            userSetting.preferredTimezone,
                            calDAVSchedule
                        )
                    );

                    convertedAppleCalDAVCalndarIntegration.appleCalDAVIntegrationSchedules = convertedSchedules;

                    return convertedAppleCalDAVCalndarIntegration;
                })
        );

        const appleCalDAVIntegration = new AppleCalDAVIntegration();
        appleCalDAVIntegration.email = appleId;
        appleCalDAVIntegration.appSpecificPassword = appSpecificPassword;
        appleCalDAVIntegration.user = user;
        appleCalDAVIntegration.appleCalDAVCalendarIntegrations = convertedCalendars;

        const creatdIntegration = await this.appleCalDAVIntegrationRepository.save(appleCalDAVIntegration);

        return creatdIntegration.toIntegration();
    }

    async remove(vendorIntegrationId: number, userId: number): Promise<boolean> {

        const deleteResult = await this.appleCalDAVIntegrationRepository.delete({
            id: vendorIntegrationId,
            userId
        });

        const isSuccess =
            deleteResult && deleteResult.affected && deleteResult.affected > 0 ?
                true :
                false;

        return isSuccess;
    }

    getIntegrationSchedulesService(): IntegrationSchedulesService {
        return this.appleIntegrationsSchedulesService;
    }

    get icloudCalDAVUrl(): string {
        return 'https://caldav.icloud.com';
    }
}
