/* eslint-disable @typescript-eslint/no-unused-vars */
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, MoreThan, Not, Repository } from 'typeorm';
import { Observable, firstValueFrom, from } from 'rxjs';
import { Auth, calendar_v3 } from 'googleapis';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AppConfigService } from '@configs/app-config.service';
import { GoogleCalendarEvent } from '@interfaces/integrations/google/google-calendar-event.interface';
import { GoogleCalendarIntegrationSearchOption } from '@interfaces/integrations/google/google-calendar-integration-search-option.interface';
import { GoogleCalendarDetail } from '@interfaces/integrations/google/google-calendar-detail.interface';
import { CalendarIntegrationService } from '@interfaces/integrations/calendar-integration.abstract-service';
import { CreatedCalendarEvent } from '@interfaces/integrations/created-calendar-event.interface';
import { GoogleCalendarAccessRole } from '@interfaces/integrations/google/google-calendar-access-role.enum';
import { CalendarIntegration } from '@interfaces/integrations/calendar-integration.interface';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { GoogleCalendarEventWatchService } from '@services/integrations/google-integration/facades/google-calendar-event-watch.service';
import { GoogleCalendarEventListService } from '@services/integrations/google-integration/facades/google-calendar-event-list.service';
import { IntegrationUtilsService } from '@services/utils/integration-utils/integration-utils.service';
import { GoogleCalendarEventCreateService } from '@services/integrations/google-integration/facades/google-calendar-event-create.service';
import { GoogleCalendarEventPatchService } from '@services/integrations/google-integration/facades/google-calendar-event-patch.service';
import { NotificationsService } from '@services/notifications/notifications.service';
import { CoreGoogleConverterService } from '@services/converters/google/core-google-converter.service';
import { GoogleCalendarIntegration } from '@entities/integrations/google/google-calendar-integration.entity';
import { GoogleIntegrationScheduledEvent } from '@entities/integrations/google/google-integration-scheduled-event.entity';
import { GoogleIntegration } from '@entities/integrations/google/google-integration.entity';
import { UserSetting } from '@entities/users/user-setting.entity';
import { ScheduledStatus } from '@entities/scheduled-events/scheduled-status.enum';
import { TeamSetting } from '@entities/teams/team-setting.entity';
import { Profile } from '@entities/profiles/profile.entity';
import { ScheduledEvent } from '@entities/scheduled-events/scheduled-event.entity';
import { User } from '@entities/users/user.entity';
import { IntegrationsRedisRepository } from '@repositories/integrations/integration-redis.repository';
import { NotAnOwnerException } from '@exceptions/not-an-owner.exception';
import { GoogleCalendarEventWatchStopService } from '../facades/google-calendar-event-watch-stop.service';

@Injectable()
export class GoogleCalendarIntegrationsService extends CalendarIntegrationService {
    constructor(
        private readonly integrationUtilService: IntegrationUtilsService,
        private readonly coreGoogleConverterService: CoreGoogleConverterService,
        private readonly notificationsService: NotificationsService,
        private readonly integrationsRedisRepository: IntegrationsRedisRepository,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        @InjectDataSource() private readonly datasource: DataSource,
        @InjectRepository(GoogleIntegrationScheduledEvent)
        private readonly googleIntegrationScheduleRepository: Repository<GoogleIntegrationScheduledEvent>,
        @InjectRepository(GoogleCalendarIntegration)
        private readonly googleCalendarIntegrationRepository: Repository<GoogleCalendarIntegration>
    ) {
        super();
    }

    async synchronizeWithGoogleCalendarEvents(syncdayGoogleCalendarIntegrationUUID: string): Promise<void> {

        const loadedGoogleCalendarIntegration = await firstValueFrom(
            this.findOne({
                googleCalendarIntegrationUUID: syncdayGoogleCalendarIntegrationUUID,
                conflictCheck: true
            })
        );

        if (!loadedGoogleCalendarIntegration) {
            this.logger.info('Channel is subscribed but Conflict check flag is false. Skipping Calendar event synchronizing.');
            return;
        }

        const loadedGoogleIntegration = loadedGoogleCalendarIntegration.googleIntegration;

        // As of now, User can have only one Google Integration
        const loadedProfile = loadedGoogleIntegration.profiles[0];
        const loadedTeamSetting = loadedProfile.team.teamSetting;
        const loadedUser = loadedProfile.user;
        const loadedUserSetting = loadedProfile.user.userSetting;

        const googleOAuthClient = this.integrationUtilService.getGoogleOAuthClient(loadedGoogleIntegration.refreshToken);

        await this.datasource.transaction(async (transactionManager) => await this._synchronizeWithGoogleCalendarEvents(
            transactionManager,
            loadedGoogleCalendarIntegration,
            loadedProfile,
            loadedTeamSetting,
            loadedUser,
            loadedUserSetting,
            {
                googleOAuthClient
            }
        ));
    }

    async _synchronizeWithGoogleCalendarEvents(
        manager: EntityManager,
        googleCalendarIntegration: GoogleCalendarIntegration,
        profile: Profile,
        teamSetting: TeamSetting,
        user: User,
        userSetting: UserSetting,
        {
            userRefreshToken,
            googleOAuthClient
        }: {
            userRefreshToken?: string;
            googleOAuthClient?: Auth.OAuth2Client;
        }
    ): Promise<void> {

        const ensuredOAuthClient = googleOAuthClient || this.integrationUtilService.getGoogleOAuthClient(
            userRefreshToken as string
        );

        const googleCalendarEventListService = new GoogleCalendarEventListService();

        const loadedGoogleEventGroup = await googleCalendarEventListService.search(ensuredOAuthClient, googleCalendarIntegration.name);
        const latestGoogleEvents = (loadedGoogleEventGroup.items || []) as GoogleCalendarEvent[];
        const loadedGoogleEventICalUIDs = latestGoogleEvents.map((item) => item.iCalUID);

        const remainedGoogleIntegrationSchedules = await this.googleIntegrationScheduleRepository.findBy({
            iCalUID: In(loadedGoogleEventICalUIDs),
            googleCalendarIntegrationId: googleCalendarIntegration.id
        });

        const remainedGoogleIntegrationScheduleEntries =
            remainedGoogleIntegrationSchedules.map((_previousGoogleIntegrationSchedule) => [_previousGoogleIntegrationSchedule.iCalUID, _previousGoogleIntegrationSchedule] );
        const remainedGoogleIntegrationScheduleMap = new Map(remainedGoogleIntegrationScheduleEntries as Array<[string, GoogleIntegrationScheduledEvent]>);

        const newEvents: GoogleCalendarEvent[] = [];

        // filter new events -> add
        latestGoogleEvents.forEach((_latestGoogleEvent) => {
            const isRemainedSchedule = remainedGoogleIntegrationScheduleMap.has(_latestGoogleEvent.iCalUID as string);
            const isNewOne = isRemainedSchedule === false;

            _latestGoogleEvent.timezone = googleCalendarIntegration.timezone;

            if (isNewOne) {
                newEvents.push(_latestGoogleEvent);
            }
        });

        const newSchedules = this.coreGoogleConverterService.convertToGoogleIntegrationSchedules({
            [googleCalendarIntegration.name]: newEvents
        }).map((_newSchedule) => {
            _newSchedule.originatedCalendarId = googleCalendarIntegration.name;
            _newSchedule.googleCalendarIntegrationId = googleCalendarIntegration.id;
            _newSchedule.host = {
                uuid: profile.uuid,
                name: profile.name,
                workspace: teamSetting.workspace,
                timezone: userSetting.preferredTimezone,
                email: user.email,
                phone: user.phone,
                language: userSetting.preferredLanguage
            };
            return _newSchedule;
        });

        const _scheduledEventRepository = manager.getRepository(ScheduledEvent);
        const _googleIntegrationScheduleRepository = manager.getRepository(GoogleIntegrationScheduledEvent);

        // create new schedules
        if (newSchedules.length > 0) {
            await _googleIntegrationScheduleRepository.save(newSchedules);
        }

        // delete old schedules
        const loadedGoogleIntegrationSchedules = await _googleIntegrationScheduleRepository.findBy({
            iCalUID: Not(In(loadedGoogleEventICalUIDs)),
            googleCalendarIntegrationId: googleCalendarIntegration.id
        });

        const deleteICalUIDs = loadedGoogleIntegrationSchedules.map(
            (_googleIntegrationSchedule) => _googleIntegrationSchedule.iCalUID
        );

        await _googleIntegrationScheduleRepository.delete({
            iCalUID: In(deleteICalUIDs),
            googleCalendarIntegrationId: googleCalendarIntegration.id
        });

        /**
         * TODO: We should find a way to improve soft delete for schedules with removing notifications
         */
        const now = new Date();
        const schedules = await _scheduledEventRepository.find({
            relations: ['scheduledEventNotifications'],
            where: {
                iCalUID: In(deleteICalUIDs),
                scheduledTime: {
                    endTimestamp: MoreThan(now)
                }
            }
        });

        const scheduledEventNotifications = schedules.flatMap((scheduledEvent) => scheduledEvent.scheduledEventNotifications);

        await this.notificationsService.sendCancellationMessages(scheduledEventNotifications);

        const canceledScheduledEventIds = schedules.map((_scheduledEvent) => _scheduledEvent.id);

        await _scheduledEventRepository.update(
            { id: In(canceledScheduledEventIds) },
            { status: ScheduledStatus.CANCELED }
        );

        await _scheduledEventRepository.softDelete({
            id: In(canceledScheduledEventIds)
        });
    }

    findOne(searchOptions: Partial<GoogleCalendarIntegrationSearchOption>): Observable<GoogleCalendarIntegration | null> {

        const options = this.__patchSearchOption(searchOptions);

        this.logger.debug({
            message: 'find one google calendar integration'
        });

        return from(
            this.googleCalendarIntegrationRepository.findOne({
                relations: [
                    'googleIntegration',
                    'googleIntegration.profiles',
                    'googleIntegration.profiles.user',
                    'googleIntegration.profiles.user.userSetting',
                    'googleIntegration.profiles.team',
                    'googleIntegration.profiles.team.teamSetting'
                ],
                where: options
            })
        );
    }

    patch(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        profileId: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        calendarIntegration: Partial<CalendarIntegration> & Pick<CalendarIntegration, 'id' | 'setting'>
    ): Promise<boolean> {
        throw new Error('Method not implemented.');
    }

    async patchAll(
        profileId: number,
        calendarIntegrations:
        Array<Partial<GoogleCalendarIntegration> & Pick<GoogleCalendarIntegration, 'id' | 'setting'>>
    ): Promise<boolean> {

        const calendarIntegrationIds = calendarIntegrations.map(
            (_calendarIntegration) => _calendarIntegration.id
        );

        const calendarIntegrationRepository = this.getCalendarIntegrationRepository();
        // check owner permission
        const loadedCalendars = await calendarIntegrationRepository.find({
            relations: [
                'googleIntegration',
                'googleIntegration.profiles',
                'googleIntegration.profiles.team',
                'googleIntegration.profiles.team.teamSetting',
                'googleIntegration.profiles.user',
                'googleIntegration.profiles.userSetting'
            ],
            where: {
                googleIntegration: {
                    profiles: {
                        id: profileId
                    }
                }
            }
        });
        const loadedCalendarIds = loadedCalendars.map((_loadedCalendar) => _loadedCalendar.id);

        const noPermissionCalendar = calendarIntegrationIds.find(
            (_calendarId) => loadedCalendarIds.includes(_calendarId) === false
        );

        if (noPermissionCalendar) {
            throw new NotAnOwnerException();
        }

        const calendarsToDeleteSchedules = calendarIntegrations.filter((calendarSettingStatus) =>
            calendarSettingStatus.setting.conflictCheck === false
        );
        const calendarIdsToDeleteSchedules = calendarsToDeleteSchedules.map((_calendarsToDeleteSchedule) => _calendarsToDeleteSchedule.id);

        await this.datasource.transaction(async (_transactionManager) => {
            const _googleCalendarIntegrationRepo = _transactionManager.getRepository(GoogleCalendarIntegration);
            const _googleIntegrationScheduleRepo = _transactionManager.getRepository(GoogleIntegrationScheduledEvent);

            const _resetSuccess = await firstValueFrom(this._resetOutboundSetting(
                _transactionManager,
                profileId
            ));

            const _resultToDeleteSchedules = await _googleIntegrationScheduleRepo.delete({
                googleCalendarIntegrationId: In(calendarIdsToDeleteSchedules)
            });

            const _resultToDeleteSchedulesSuccess = _resultToDeleteSchedules.affected && _resultToDeleteSchedules.affected > 0;

            const _googleCalendarIntegrations = await _googleCalendarIntegrationRepo.save(
                calendarIntegrations,
                {
                    transaction: true
                }
            );

            // It is more cost-effective to update already loaded calendars than to execute an SQL query with relation join
            const updatedCalendars = loadedCalendars.map((_loadedCalendar) => {
                const _googleCalendarIntegration = _googleCalendarIntegrations.find((__googleCalendarIntegration) => __googleCalendarIntegration.id === _loadedCalendar.id);

                if (_googleCalendarIntegration) {
                    _loadedCalendar.setting = _googleCalendarIntegration?.setting;
                }

                return _loadedCalendar;
            });

            const _integrationGoogleOAuthClientMap = new Map<number, Auth.OAuth2Client>();
            const _inboundGoogleCalendarIntegrations = updatedCalendars.filter((googleCalendarSettingStatus) =>
                googleCalendarSettingStatus.setting.conflictCheck === true
            );

            _inboundGoogleCalendarIntegrations
                .map((_inboundGoogleCalendarIntegration) => _inboundGoogleCalendarIntegration.googleIntegration)
                .forEach((_googleIntegration) => {
                    const userRefreshToken = _googleIntegration.refreshToken;

                    if (_integrationGoogleOAuthClientMap.has(_googleIntegration.id) === false) {
                        const googleOAuthClient = this.integrationUtilService.getGoogleOAuthClient(userRefreshToken);
                        _integrationGoogleOAuthClientMap.set(_googleIntegration.id, googleOAuthClient);
                    }
                });

            if (_inboundGoogleCalendarIntegrations.length > 0) {

                const loadedProfile = loadedCalendars[0].googleIntegration.profiles[0];
                const loadedTeamSetting = loadedProfile.team.teamSetting;
                const loadedUser = loadedProfile.user;
                const loadedUserSetting = loadedProfile.user.userSetting;

                await Promise.all(
                    _inboundGoogleCalendarIntegrations
                        .map(async (__googleCalendarIntegration) => {

                            const __googleOAuthClient = _integrationGoogleOAuthClientMap.get(__googleCalendarIntegration.googleIntegrationId);

                            await this._synchronizeWithGoogleCalendarEvents(
                                _transactionManager,
                                __googleCalendarIntegration,
                                loadedProfile,
                                loadedTeamSetting,
                                loadedUser,
                                loadedUserSetting,
                                {
                                    googleOAuthClient: __googleOAuthClient
                                }
                            );

                            return await this.resubscriptionCalendar(__googleCalendarIntegration);
                        })
                );
            }

            return _resetSuccess && _resultToDeleteSchedulesSuccess && _googleCalendarIntegrations.length > 0;
        });

        return true;
    }

    async createCalendarEvent(
        googleIntegration: GoogleIntegration,
        googleCalendarIntegration: GoogleCalendarIntegration,
        hostTimezone: string,
        scheduledEvent: ScheduledEvent
    ): Promise<CreatedCalendarEvent> {

        const calendarId = googleCalendarIntegration.name;

        const userRefreshToken = googleIntegration.refreshToken;

        const ensuredOAuthClient = this.integrationUtilService.getGoogleOAuthClient(
            userRefreshToken
        );

        /**
         * TODO: PreferredTimezone should be replaced as scheduled event value.
         */
        const newGoogleEventBody = this.coreGoogleConverterService.convertScheduledEventToGoogleCalendarEvent(
            hostTimezone,
            googleCalendarIntegration.name,
            scheduledEvent
        );

        const googleCalendarEventCreateService = new GoogleCalendarEventCreateService();

        const createdGoogleEvent = await googleCalendarEventCreateService.create(
            ensuredOAuthClient,
            calendarId,
            newGoogleEventBody,
            true
        );

        const createdCalendarEvent = {
            iCalUID: createdGoogleEvent.iCalUID,
            generatedEventUrl: createdGoogleEvent.htmlLink,
            raw: createdGoogleEvent
        } as CreatedCalendarEvent;

        return createdCalendarEvent;
    }

    async patchCalendarEvent(
        googleIntegration: GoogleIntegration,
        googleCalendarIntegration: GoogleCalendarIntegration,
        patchedScheduledEvent: ScheduledEvent,
        createdCalendarEvent: CreatedCalendarEvent & { raw: calendar_v3.Schema$Event & { id: string } }
    ): Promise<boolean> {

        const { raw: googleCalendarEvent } = createdCalendarEvent;

        const calendarId = googleCalendarIntegration.name;

        const userRefreshToken = googleIntegration.refreshToken;

        const ensuredOAuthClient = this.integrationUtilService.getGoogleOAuthClient(
            userRefreshToken
        );

        const googleCalendarEventPatchService = new GoogleCalendarEventPatchService();

        const patchedGoogleCalendarEvent = await googleCalendarEventPatchService.patch(
            ensuredOAuthClient,
            calendarId,
            googleCalendarEvent.id,
            {
                description: patchedScheduledEvent.description
            }
        );

        return !!patchedGoogleCalendarEvent;
    }

    async resubscriptionCalendar(
        loadedInboundConflictCheckCalendar: GoogleCalendarIntegration
    ): Promise<boolean> {

        const inboundGoogleIntegration = loadedInboundConflictCheckCalendar.googleIntegration;
        const newOAuthClient = this.integrationUtilService.getGoogleOAuthClient(inboundGoogleIntegration.refreshToken);

        // check first subscription
        const subscriptionStatus = await this.integrationsRedisRepository.getGoogleCalendarSubscriptionStatus(loadedInboundConflictCheckCalendar.uuid);

        // stopping previous calendar notification as Unsubscription
        if (subscriptionStatus) {

            const loadedGoogleCalendarDetail = await this.integrationsRedisRepository.getGoogleCalendarDetail(
                inboundGoogleIntegration.uuid,
                loadedInboundConflictCheckCalendar.uuid
            );

            if (loadedGoogleCalendarDetail) {
                await this.unsubscribeCalendar(
                    loadedGoogleCalendarDetail,
                    inboundGoogleIntegration,
                    loadedInboundConflictCheckCalendar,
                    { OAuthClient: newOAuthClient }
                );
            }
        }

        // set subscription status as enable
        await this.integrationsRedisRepository.setGoogleCalendarSubscriptionStatus(loadedInboundConflictCheckCalendar.uuid);

        await this.subscribeCalendar(
            inboundGoogleIntegration,
            loadedInboundConflictCheckCalendar,
            { OAuthClient: newOAuthClient }
        );

        return true;
    }

    async unsubscribeCalendar(
        googleCalendarDetail: GoogleCalendarDetail,
        googleIntegration: GoogleIntegration,
        googleCalendarIntegration: GoogleCalendarIntegration,
        {
            userRefreshToken,
            OAuthClient
        }: {
            userRefreshToken?: string;
            OAuthClient?: Auth.OAuth2Client;
        }
    ): Promise<boolean> {

        if (!userRefreshToken && !OAuthClient) {
            throw new InternalServerErrorException('Both user refresh token and OAuth client are null');
        }

        const ensuredOAuthClient = OAuthClient || this.integrationUtilService.getGoogleOAuthClient(
            userRefreshToken as string
        );

        const googleCalendarEventWatchStopService = new GoogleCalendarEventWatchStopService();

        await googleCalendarEventWatchStopService.stopWatch(
            ensuredOAuthClient,
            googleCalendarDetail.webhookNotification.xGoogChannelId,
            googleCalendarDetail.webhookNotification.xGoogResourceId
        );

        await this.integrationsRedisRepository.deleteGoogleCalendarDetail(
            googleIntegration.uuid,
            googleCalendarIntegration.uuid
        );

        await this.integrationsRedisRepository.deleteGoogleCalendarSubscriptionStatus(googleCalendarIntegration.uuid);

        return true;
    }

    async subscribeCalendar(
        googleIntegration: GoogleIntegration,
        googleCalendarIntegration: GoogleCalendarIntegration,
        {
            userRefreshToken,
            OAuthClient
        }: {
            userRefreshToken?: string;
            OAuthClient?: Auth.OAuth2Client;
        }
    ): Promise<boolean> {

        try {

            if (!userRefreshToken && !OAuthClient) {
                throw new InternalServerErrorException('Both user refresh token and OAuth client are null');
            }

            const ensuredOAuthClient = OAuthClient || this.integrationUtilService.getGoogleOAuthClient(
                userRefreshToken as string
            );

            // Subscribe new google calendar notification
            const googleCalendarEventWatchService = new GoogleCalendarEventWatchService();
            const callback = [
                AppConfigService.getHost(),
                'v1/integrations/calendars/notifications/google',
                googleCalendarIntegration.uuid
            ].join('/');

            const watchResponse = await googleCalendarEventWatchService.watch(
                ensuredOAuthClient,
                googleCalendarIntegration.name,
                googleCalendarIntegration.uuid,
                callback
            );

            await this.integrationsRedisRepository.setGoogleCalendarDetail(
                googleIntegration.uuid,
                googleCalendarIntegration.uuid,
                {
                    webhookNotification: {
                        xGoogChannelId: googleCalendarIntegration.uuid,
                        xGoogResourceId: watchResponse.resourceId as string,
                        xGoogResourceUri: watchResponse.resourceUri as string,
                        xGoogChannelExpiration: watchResponse.expiration as string,
                        raw: watchResponse
                    }
                }
            );

            await this.integrationsRedisRepository.setGoogleCalendarSubscriptionStatus(googleCalendarIntegration.uuid);
        } catch (error) {
            this.logger.error({
                message: 'Error while Google Calendar Integration Subscribing:',
                error
            });
        }

        return true;
    }

    async getGoogleCalendarSubscriptionStatus(googleChannelId: string): Promise<boolean> {
        const status = await this.integrationsRedisRepository.getGoogleCalendarSubscriptionStatus(googleChannelId);

        return status;
    }

    __patchSearchOption({
        profileId,
        profileUUID,
        teamWorkspace,
        googleCalendarIntegrationUUID,
        conflictCheck,
        outboundWriteSync,
        googleCalendarAccessRole
    }: Partial<GoogleCalendarIntegrationSearchOption> = {}):
        FindOptionsWhere<GoogleCalendarIntegration> |
        Array<FindOptionsWhere<GoogleCalendarIntegration>> {
        let options: FindOptionsWhere<GoogleCalendarIntegration> | Array<FindOptionsWhere<GoogleCalendarIntegration>> = {
            uuid: googleCalendarIntegrationUUID,
            setting: {
                conflictCheck,
                outboundWriteSync
            },
            googleIntegration: {
                profiles: {
                    team: {
                        teamSetting: {
                            workspace: teamWorkspace
                        }
                    },
                    id: profileId,
                    uuid: profileUUID
                }
            }
        };

        if (googleCalendarAccessRole) {
            if (googleCalendarAccessRole === GoogleCalendarAccessRole.WRITER) {
                const readerAccessOption = {
                    ...options,
                    googleCalendarAccessRole: GoogleCalendarAccessRole.WRITER
                };
                options = [
                    readerAccessOption,
                    {
                        ...readerAccessOption,
                        googleCalendarAccessRole: GoogleCalendarAccessRole.OWNER
                    }
                ] as Array<FindOptionsWhere<GoogleCalendarIntegration>>;
            } else {
                options = {
                    ...options,
                    googleCalendarAccessRole
                };
            }
        }

        return options;
    }

    getIntegrationProfileRelationPath(integrationAlias = 'integration'): string {
        return `${integrationAlias}.users`;
    }

    getIntegrationIdAlias(): string {
        return 'googleIntegrationId';
    }

    getIntegrationEntity(): new () => GoogleIntegration {
        return GoogleIntegration;
    }

    getCalendarIntegrationEntity(): new () => GoogleCalendarIntegration {
        return GoogleCalendarIntegration;
    }

    getCalendarIntegrationRepository(): Repository<GoogleCalendarIntegration> {
        return this.googleCalendarIntegrationRepository;
    }

    getProfileRelationConditions(profileId: number, options: FindOptionsWhere<CalendarIntegration>): FindOptionsWhere<CalendarIntegration> {
        return {
            ...options,
            googleIntegration: {
                profiles: {
                    id: profileId
                }
            }
        } as FindOptionsWhere<GoogleCalendarIntegration> as FindOptionsWhere<CalendarIntegration>;
    }

    getIntegrationVendor(): IntegrationVendor {
        return IntegrationVendor.GOOGLE;
    }
}
