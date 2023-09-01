import { URL } from 'url';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { GoogleIntegrationBody } from '@core/interfaces/integrations/google/google-integration-body.interface';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleIntegrationSchedulesService } from '@services/integrations/google-integration/google-integration-schedules/google-integration-schedules.service';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { IntegrationsServiceInterface } from '@services/integrations/integrations.service.interface';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { Integration } from '@entity/integrations/integration.entity';
import { SearchByUserOption } from '@app/interfaces/search-by-user-option.interface';
import { SyncdayGoogleOAuthTokenResponse } from '@app/interfaces/auth/syncday-google-oauth-token-response.interface';

@Injectable()
export class GoogleIntegrationsService implements IntegrationsServiceInterface {
    constructor(
        private readonly configService: ConfigService,
        private readonly googleConverterService: GoogleConverterService,
        private readonly googleCalendarIntegrationsService: GoogleCalendarIntegrationsService,
        private readonly googleIntegrationSchedulesService: GoogleIntegrationSchedulesService,
        private readonly integrationsRedisRepository: IntegrationsRedisRepository,
        @InjectRepository(GoogleIntegration)
        private readonly googleIntegrationRepository: Repository<GoogleIntegration>
    ) {}

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callback(_request: Request, _response: Response): void {
        throw new Error('Method not implemented.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    findOne(userSearchOption: SearchByUserOption): Promise<Integration | null> {
        throw new Error('Method not implemented.');
    }

    generateOAuth2RedirectURI(
        syncdayGoogleOAuthTokenResponse: SyncdayGoogleOAuthTokenResponse
    ): string {

        const {
            issuedToken,
            isNewbie,
            insufficientPermission
        } = syncdayGoogleOAuthTokenResponse;

        const { googleOAuth2SuccessRedirectURI } = AppConfigService.getGoogleOAuth2Setting(
            this.configService
        );

        const redirectURL = new URL(googleOAuth2SuccessRedirectURI);
        redirectURL.searchParams.append('accessToken', issuedToken.accessToken);
        redirectURL.searchParams.append('refreshToken', issuedToken.refreshToken);
        redirectURL.searchParams.append('newbie', String(isNewbie));
        redirectURL.searchParams.append('insufficientPermission', String(insufficientPermission));

        return redirectURL.toString();
    }

    async search({ userId }: SearchByUserOption): Promise<GoogleIntegration[]> {
        return await this.googleIntegrationRepository.findBy({
            users: {
                id: userId
            }
        });
    }

    /**
     * This method saves google integration including calendars.
     *
     * @param user
     * @param googleAuthToken
     * @param googleCalendarIntegrations
     * @returns
     */
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
    async create(
        user: User,
        userSetting: UserSetting,
        googleAuthToken: OAuthToken,
        googleCalendarIntegrations: GoogleCalendarIntegration[],
        googleIntegrationBody: GoogleIntegrationBody
    ): Promise<GoogleIntegration> {
        return this._create(
            this.googleIntegrationRepository.manager,
            user,
            userSetting,
            googleAuthToken,
            googleCalendarIntegrations,
            googleIntegrationBody
        );
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    async _create(
        manager: EntityManager,
        user: User,
        userSetting: UserSetting,
        googleAuthToken: OAuthToken,
        googleCalendarIntegrations: GoogleCalendarIntegration[],
        googleIntegrationBody: GoogleIntegrationBody
    ): Promise<GoogleIntegration> {
        const { workspace, preferredTimezone: timezone } = userSetting;

        const newGoogleIngration: GoogleIntegration = {
            accessToken: googleAuthToken.accessToken,
            refreshToken: googleAuthToken.refreshToken,
            email: googleIntegrationBody.googleUserEmail,
            users: [user],
            googleCalendarIntegrations: googleCalendarIntegrations.map((calendar) => {

                /**
                 * TODO: It should be extracted as ORM Subscriber.
                 */
                if (calendar.primary) {
                    calendar.setting = {
                        conflictCheck: true,
                        outboundWriteSync: true,
                        inboundDecliningSync: false
                    };
                }

                calendar.users = [user];
                return calendar;
            })
        } as GoogleIntegration;

        const _googleIntegrationRepository = manager.getRepository(GoogleIntegration);
        const createdGoogleIntegration = await _googleIntegrationRepository.save(newGoogleIngration);

        const { schedules: googleCalendarScheduleBody } = googleIntegrationBody;

        const hasSchedules = Object.keys(googleCalendarScheduleBody).length > 0;

        // Google Channel Id is same to google calendar integration uuid.
        const primaryCalendarIntegration = createdGoogleIntegration.googleCalendarIntegrations.find((_calendar) => _calendar.primary) as GoogleCalendarIntegration;

        if (hasSchedules) {

            await this.integrationsRedisRepository.setGoogleCalendarSubscriptionStatus(
                primaryCalendarIntegration.uuid
            );

            const googleIntegrationSchedules = this.googleConverterService.convertToGoogleIntegrationSchedules(googleCalendarScheduleBody);

            const _createdGoogleCalendarIntegrations = createdGoogleIntegration.googleCalendarIntegrations;

            const patchedGoogleIntegrationSchedules = googleIntegrationSchedules.map((_googleIntegrationSchedule) => {
                const _googleCalendarIntegration = _createdGoogleCalendarIntegrations.find(
                    (__createdGoogleCalendarIntegration) =>
                        __createdGoogleCalendarIntegration.name === _googleIntegrationSchedule.originatedCalendarId
                );

                _googleIntegrationSchedule.host = {
                    uuid: user.uuid,
                    workspace,
                    timezone
                };
                _googleIntegrationSchedule.googleCalendarIntegrationId = _googleCalendarIntegration?.id as number;

                return _googleIntegrationSchedule;
            });

            await this.googleIntegrationSchedulesService._saveAll(
                manager,
                patchedGoogleIntegrationSchedules
            );
        }

        await this.googleCalendarIntegrationsService.subscribeCalendar(
            newGoogleIngration,
            primaryCalendarIntegration,
            {
                userRefreshToken: googleAuthToken.refreshToken
            }
        );

        return createdGoogleIntegration;
    }

    async remove(
        googleIntegrationId: number,
        userId: number
    ): Promise<boolean> {
        return this._remove(
            this.googleIntegrationRepository.manager,
            googleIntegrationId,
            userId
        );
    }

    async _remove(
        manager: EntityManager,
        googleIntegrationId: number,
        userId: number
    ): Promise<boolean> {

        const _googleIntegrationRepository = manager.getRepository(GoogleIntegration);

        const googleIntegration = await _googleIntegrationRepository.findOneOrFail({
            relations: {
                googleCalendarIntegrations: true
            },
            where: {
                id: googleIntegrationId,
                users: {
                    id: userId
                }
            }
        });

        await _googleIntegrationRepository.delete(googleIntegrationId);

        await this.integrationsRedisRepository.deleteGoogleCalendarDetails(googleIntegration.uuid);

        const googleChannelIds = googleIntegration.googleCalendarIntegrations.map((_cal) => _cal.name);

        await this.integrationsRedisRepository.deleteGoogleCalendarSubscriptionsStatus(googleChannelIds);

        // The user can have a only one Google Integration
        const loadedGoogleCalendarDetailRecords = await this.integrationsRedisRepository.getGoogleCalendarsDetailAll(googleIntegration.uuid);

        // TODO: it should be improved in future.
        for (const googleCalendarIntegration of googleIntegration.googleCalendarIntegrations) {
            const loadedGoogleCalendarDetailRecord = loadedGoogleCalendarDetailRecords[googleCalendarIntegration.uuid];

            if (loadedGoogleCalendarDetailRecord) {

                await this.googleCalendarIntegrationsService.unsubscribeCalendar(
                    loadedGoogleCalendarDetailRecord,
                    googleIntegration,
                    googleCalendarIntegration,
                    {
                        userRefreshToken: googleIntegration.refreshToken
                    }
                );
            }
        }

        return true;
    }
}
