import { URL } from 'url';
import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { Observable } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { GoogleIntegrationBody } from '@core/interfaces/integrations/google/google-integration-body.interface';
import { CalendarIntegrationService } from '@core/interfaces/integrations/calendar-integration.abstract-service';
import { ConferenceLinkIntegrationService } from '@core/interfaces/integrations/conference-link-integration.abstract-service';
import { IntegrationScheduledEventsService } from '@core/interfaces/integrations/integration-scheduled-events.abstract-service';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationSearchOption } from '@interfaces/integrations/integration-search-option.interface';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { HostProfile } from '@interfaces/scheduled-events/host-profile.interface';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleIntegrationSchedulesService } from '@services/integrations/google-integration/google-integration-schedules/google-integration-schedules.service';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { IntegrationsFactory } from '@services/integrations/integrations.factory.interface';
import { IntegrationScheduledEventsWrapperService } from '@services/integrations/integration-scheduled-events-wrapper-service.interface';
import { CalendarIntegrationWrapperService } from '@services/integrations/calendar-integration-wrapper-service.interface';
import { ConferenceLinkIntegrationWrapperService } from '@services/integrations/conference-link-integration-wrapper-service.interface';
import { GoogleConferenceLinkIntegrationService } from '@services/integrations/google-integration/google-conference-link-integration/google-conference-link-integration.service';
import { EventsService } from '@services/events/events.service';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { Integration } from '@entity/integrations/integration.entity';
import { Host } from '@entity/scheduled-events/host.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { SyncdayOAuth2TokenResponse } from '@app/interfaces/auth/syncday-oauth2-token-response.interface';
import { CalendarCreateOption } from '@app/interfaces/integrations/calendar-create-option.interface';

@Injectable()
export class GoogleIntegrationsService implements
    IntegrationsFactory,
    IntegrationScheduledEventsWrapperService,
    CalendarIntegrationWrapperService,
    ConferenceLinkIntegrationWrapperService
{
    constructor(
        private readonly configService: ConfigService,
        private readonly eventsService: EventsService,
        private readonly googleConverterService: GoogleConverterService,
        private readonly googleCalendarIntegrationsService: GoogleCalendarIntegrationsService,
        private readonly googleConferenceLinkIntegrationService: GoogleConferenceLinkIntegrationService,
        private readonly googleIntegrationSchedulesService: GoogleIntegrationSchedulesService,
        private readonly integrationsRedisRepository: IntegrationsRedisRepository,
        @InjectDataSource() private datasource: DataSource,
        @InjectRepository(GoogleIntegration)
        private readonly googleIntegrationRepository: Repository<GoogleIntegration>,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    findIn(hostProfiles: HostProfile[]): Promise<Integration | null> {

        const hostProfileIds = hostProfiles.map((_hostProfile) => _hostProfile.profileId);

        return this.googleIntegrationRepository.findOne({
            where: {
                profiles: {
                    id: In(hostProfileIds)
                }
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callback(_request: Request, _response: Response): void {
        throw new Error('Method not implemented.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    validate(loadedIntegration: Integration): Observable<boolean> {
        throw new Error('Method not implemented.');
    }

    count({
        profileId
    }: IntegrationSearchOption): Promise<number> {
        return this.googleIntegrationRepository.countBy({
            profiles: {
                id: profileId
            }
        });
    }

    findOne(profileSearchOption: Partial<IntegrationSearchOption>): Promise<Integration | null> {
        return this.googleIntegrationRepository.findOne({
            where: {
                profiles: {
                    id: profileSearchOption.profileId
                }
            }
        });
    }

    generateOAuth2RedirectURI(
        syncdayGoogleOAuthTokenResponse: SyncdayOAuth2TokenResponse
    ): string {

        const {
            issuedToken,
            isNewbie,
            insufficientPermission
        } = syncdayGoogleOAuthTokenResponse;

        const { oauth2SuccessRedirectURI } = AppConfigService.getOAuth2Setting(
            IntegrationVendor.GOOGLE,
            this.configService
        );

        const redirectURL = new URL(oauth2SuccessRedirectURI);
        redirectURL.searchParams.append('accessToken', issuedToken.accessToken);
        redirectURL.searchParams.append('refreshToken', issuedToken.refreshToken);
        redirectURL.searchParams.append('newbie', String(isNewbie));
        redirectURL.searchParams.append('insufficientPermission', String(insufficientPermission));

        return redirectURL.toString();
    }

    async search({
        profileId,
        withCalendarIntegrations
    }: IntegrationSearchOption): Promise<Integration[]> {

        const relations = withCalendarIntegrations ? ['googleCalendarIntegrations'] : [];

        const googleIntegrations = await this.googleIntegrationRepository.find({
            relations,
            where: {
                profiles: {
                    id: profileId
                }
            }
        });

        return googleIntegrations.map((_googleIntegration) => _googleIntegration.toIntegration());
    }

    /**
     * This method saves google integration including calendars.
     *
     * @param user
     * @param googleAuthToken
     * @param googleCalendarIntegrations
     * @returns
     */
    create(
        profile: Profile,
        teamSetting: TeamSetting,
        user: User,
        userSetting: UserSetting,
        googleAuthToken: OAuthToken,
        googleCalendarIntegrations: GoogleCalendarIntegration[],
        googleIntegrationBody: GoogleIntegrationBody,
        options: CalendarCreateOption = {
            isFirstIntegration: true
        }
    ): Promise<GoogleIntegration> {
        return this.datasource.transaction((transactionManager) =>
            this._create(
                transactionManager,
                profile,
                teamSetting,
                user,
                userSetting,
                googleAuthToken,
                googleCalendarIntegrations,
                googleIntegrationBody,
                options
            )
        );
    }

    async _create(
        manager: EntityManager,
        profile: Profile,
        teamSetting: TeamSetting,
        user: User,
        userSetting: UserSetting,
        googleAuthToken: OAuthToken,
        googleCalendarIntegrations: GoogleCalendarIntegration[],
        googleIntegrationBody: GoogleIntegrationBody,
        {
            isFirstIntegration
        }: CalendarCreateOption = {
            isFirstIntegration: true
        } as CalendarCreateOption
    ): Promise<GoogleIntegration> {
        const { workspace } = teamSetting;
        const {
            preferredTimezone: timezone,
            preferredLanguage: language
        } = userSetting;

        const _googleIntegrationRepository = manager.getRepository(GoogleIntegration);

        let isFirstPrimary = true;

        const newGoogleIngration: GoogleIntegration = {
            accessToken: googleAuthToken.accessToken,
            refreshToken: googleAuthToken.refreshToken,
            email: googleIntegrationBody.googleUserEmail,
            googleCalendarIntegrations: googleCalendarIntegrations.map((calendar) => {

                let calendarSetting = {
                    conflictCheck: false,
                    outboundWriteSync: false,
                    inboundDecliningSync: false
                };

                if (calendar.primary && isFirstIntegration && isFirstPrimary) {
                    calendarSetting = {
                        conflictCheck: true,
                        outboundWriteSync: true,
                        inboundDecliningSync: false
                    };

                    isFirstPrimary = false;
                }

                calendar.setting = calendarSetting;

                this.logger.info({
                    message: 'calendar setting is patched',
                    calendarId: calendar.id,
                    userId: user.id,
                    profileId: profile.id,
                    calendarSetting,
                    calendarPrimary: calendar.primary,
                    isFirstIntegration,
                    isFirstPrimary
                });

                // calendar.users = [{ id: user.id }] as User[];
                return plainToInstance(GoogleCalendarIntegration, calendar);
            }),
            profiles: [{ id: profile.id }]
        } as GoogleIntegration;
        const createdGoogleIntegration = await _googleIntegrationRepository.save(newGoogleIngration);

        const { schedules: googleCalendarScheduledEventBody } = googleIntegrationBody;

        const hasSchedules = Object.keys(googleCalendarScheduledEventBody).length > 0;

        // Google Channel Id is same to google calendar integration uuid.
        const primaryCalendarIntegration = createdGoogleIntegration.googleCalendarIntegrations.find((_calendar) => _calendar.primary) as GoogleCalendarIntegration;

        if (hasSchedules) {

            await this.integrationsRedisRepository.setGoogleCalendarSubscriptionStatus(
                primaryCalendarIntegration.uuid
            );

            const googleIntegrationSchedules = this.googleConverterService.convertToGoogleIntegrationSchedules(googleCalendarScheduledEventBody);

            const _createdGoogleCalendarIntegrations = createdGoogleIntegration.googleCalendarIntegrations;

            const patchedGoogleIntegrationSchedules = googleIntegrationSchedules.map((_googleIntegrationSchedule) => {
                const _googleCalendarIntegration = _createdGoogleCalendarIntegrations.find(
                    (__createdGoogleCalendarIntegration) =>
                        __createdGoogleCalendarIntegration.name === _googleIntegrationSchedule.originatedCalendarId
                );

                _googleIntegrationSchedule.host = {
                    uuid: profile.uuid,
                    name: profile.name,
                    workspace,
                    logo: teamSetting.brandImagePath
                } as Host;

                const hostProfile: HostProfile = {
                    name: profile.name,
                    profileId: profile.id,
                    profileUUID: profile.uuid,
                    workspace,
                    timezone,
                    email: user.email,
                    phone: user.phone,
                    language
                };

                _googleIntegrationSchedule.hostProfiles = [hostProfile];
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

    patch(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _vendorIntegrationId: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        profileId: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _paritalIntegration?: Integration | undefined
    ): Observable<boolean> {
        throw new Error('Method not implemented.');
    }

    async remove(
        googleIntegrationId: number,
        profileId: number
    ): Promise<boolean> {
        return this.datasource.transaction((tranactionManager) =>
            this._remove(
                tranactionManager,
                googleIntegrationId,
                profileId
            )
        );
    }

    async _remove(
        manager: EntityManager,
        googleIntegrationId: number,
        profileId: number
    ): Promise<boolean> {

        const _googleIntegrationRepository = manager.getRepository(GoogleIntegration);
        const _eventRepository = manager.getRepository(Event);

        const googleIntegration = await _googleIntegrationRepository.findOneOrFail({
            relations: {
                googleCalendarIntegrations: true
            },
            where: {
                id: googleIntegrationId,
                profiles: {
                    id: profileId
                }
            }
        });

        const googleChannelIds = googleIntegration.googleCalendarIntegrations.map((_cal) => _cal.name);

        await _googleIntegrationRepository.delete(googleIntegrationId);

        const noLocationEventTargets = await this.eventsService.searchUniqueLinkProviderEvents(profileId, [ContactType.GOOGLE_MEET]);

        const eventIds = noLocationEventTargets.map((_event) => _event.id);

        await _eventRepository.update({
            id: In(eventIds)
        }, {
            contacts: [{ type: ContactType.NO_LOCATION, value: '' }]
        });

        await this.integrationsRedisRepository.deleteGoogleCalendarDetails(googleIntegration.uuid);
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

    getIntegrationScheduledEventsService(): IntegrationScheduledEventsService {
        return this.googleIntegrationSchedulesService;
    }

    getCalendarIntegrationsService(): CalendarIntegrationService {
        return this.googleCalendarIntegrationsService;
    }

    getConferenceLinkIntegrationService(): ConferenceLinkIntegrationService {
        return this.googleConferenceLinkIntegrationService;
    }
}
