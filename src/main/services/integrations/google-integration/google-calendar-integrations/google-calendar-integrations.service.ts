/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, Not, Repository } from 'typeorm';
import { Observable, firstValueFrom, from } from 'rxjs';
import { Auth, calendar_v3 } from 'googleapis';
import { AppConfigService } from '@config/app-config.service';
import { GoogleCalendarAccessRole } from '@interfaces/integrations/google/google-calendar-access-role.enum';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { GoogleCalendarEventWatchService } from '@services/integrations/google-integration/facades/google-calendar-event-watch.service';
import { GoogleCalendarEventListService } from '@services/integrations/google-integration/facades/google-calendar-event-list.service';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { IntegrationUtilsService } from '@services/util/integration-utils/integration-utils.service';
import { GoogleCalendarEventCreateService } from '@services/integrations/google-integration/facades/google-calendar-event-create.service';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { GoogleCalendarIntegrationSearchOption } from '@app/interfaces/integrations/google/google-calendar-integration-search-option.interface';
import { GoogleCalendarDetail } from '@app/interfaces/integrations/google/google-calendar-detail.interface';
import { GoogleCalendarEventWatchStopService } from '../facades/google-calendar-event-watch-stop.service';

@Injectable()
export class GoogleCalendarIntegrationsService {
    constructor(
        private readonly integrationUtilService: IntegrationUtilsService,
        private readonly googleConverterService: GoogleConverterService,
        private readonly integrationsRedisRepository: IntegrationsRedisRepository,
        @InjectDataSource() private readonly datasource: DataSource,
        @InjectRepository(GoogleIntegrationSchedule)
        private readonly googleIntegrationScheduleRepository: Repository<GoogleIntegrationSchedule>,
        @InjectRepository(GoogleCalendarIntegration)
        private readonly googleCalendarIntegrationRepository: Repository<GoogleCalendarIntegration>
    ) {}

    async synchronizeWithGoogleCalendarEvents(syncdayGoogleCalendarIntegrationUUID: string): Promise<void> {

        const loadedGoogleCalendarIntegration = await firstValueFrom(
            this.findOne({
                googleCalendarIntegrationUUID: syncdayGoogleCalendarIntegrationUUID,
                conflictCheck: true
            })
        );

        if (!loadedGoogleCalendarIntegration) {
            return;
        }

        const loadedGoogleIntegration = loadedGoogleCalendarIntegration.googleIntegration;

        const googleOAuthClient = this.integrationUtilService.getGoogleOAuthClient(loadedGoogleIntegration.refreshToken);

        const googleCalendarEventListService = new GoogleCalendarEventListService();

        const loadedGoogleEventGroup = await googleCalendarEventListService.search(googleOAuthClient, loadedGoogleCalendarIntegration.name);
        const latestGoogleEvents = (loadedGoogleEventGroup.items || []);
        const loadedGoogleEventICalUIDs = latestGoogleEvents.map((item) => item.iCalUID);

        const remainedGoogleIntegrationSchedules = await this.googleIntegrationScheduleRepository.findBy({
            iCalUID: In(loadedGoogleEventICalUIDs)
        });

        const remainedGoogleIntegrationScheduleEntries =
            remainedGoogleIntegrationSchedules.map((_previousGoogleIntegrationSchedule) => [_previousGoogleIntegrationSchedule.iCalUID, _previousGoogleIntegrationSchedule] );
        const remainedGoogleIntegrationScheduleMap = new Map(remainedGoogleIntegrationScheduleEntries as Array<[string, GoogleIntegrationSchedule]>);

        const newEvents: calendar_v3.Schema$Event[] = [];

        // filter new events -> add
        latestGoogleEvents.forEach((_latestGoogleEvent) => {
            const isRemainedSchedule = remainedGoogleIntegrationScheduleMap.has(_latestGoogleEvent.iCalUID as string);
            const isNewOne = isRemainedSchedule === false;

            if (isNewOne) {
                newEvents.push(_latestGoogleEvent);
            }
        });

        const newSchedules = this.googleConverterService.convertToGoogleIntegrationSchedules({
            [loadedGoogleCalendarIntegration.name]: newEvents
        }).map((_newSchedule) => {
            _newSchedule.originatedCalendarId = loadedGoogleCalendarIntegration.name;
            _newSchedule.googleCalendarIntegrationId = loadedGoogleCalendarIntegration.id;
            return _newSchedule;
        });

        await this.datasource.transaction(async (transactionManager) => {

            const _googleIntegrationScheduleRepository = transactionManager.getRepository(GoogleIntegrationSchedule);

            // create new schedules
            if (newSchedules.length > 0) {
                await _googleIntegrationScheduleRepository.save(newSchedules);
            }

            // delete old schedules
            await _googleIntegrationScheduleRepository.delete({
                iCalUID: Not(In(loadedGoogleEventICalUIDs))
            });
        });
    }

    search({
        userId,
        googleCalendarIntegrationUUID
    }: Partial<GoogleCalendarIntegrationSearchOption> = {}): Observable<GoogleCalendarIntegration[]> {

        let options: FindOptionsWhere<GoogleCalendarIntegration> = {};

        if (userId) {
            options = {
                ...options,
                users: {
                    id: userId
                }
            };
        }

        if (googleCalendarIntegrationUUID) {
            options = {
                ...options,
                uuid: googleCalendarIntegrationUUID
            };
        }

        return from(
            this.googleCalendarIntegrationRepository.find({
                where: options
            })
        );
    }

    findOne(searchOptions: Partial<GoogleCalendarIntegrationSearchOption>): Observable<GoogleCalendarIntegration> {

        const options = this.__patchSearchOption(searchOptions);

        return from(
            this.googleCalendarIntegrationRepository.findOneOrFail({
                relations: [
                    'googleIntegration',
                    'googleIntegration.users',
                    'googleIntegration.users.userSetting'
                ],
                where: options
            })
        );
    }

    async patch(
        userId: number,
        googleCalendarIntegrations:
        Array<Partial<GoogleCalendarIntegration> & Pick<GoogleCalendarIntegration, 'id' | 'setting'>>
    ): Promise<boolean> {

        const googleCalendarIntegrationIds = googleCalendarIntegrations.map(
            (_calendarIntegration) => _calendarIntegration.id
        );

        // check owner permission
        const loadedCalendars = await this.googleCalendarIntegrationRepository.find({
            relations: ['googleIntegration'],
            where: {
                id: In(googleCalendarIntegrationIds),
                users: {
                    id: userId
                }
            }
        });
        const loadedCalendarIds = loadedCalendars.map((_loadedCalendar) => _loadedCalendar.id);

        const noPermissionCalendar = googleCalendarIntegrationIds.find(
            (_calendarId) => loadedCalendarIds.includes(_calendarId) === false
        );
        const isLengthStrange = loadedCalendars.length !== googleCalendarIntegrations.length;

        if (noPermissionCalendar && isLengthStrange) {
            throw new NotAnOwnerException();
        }

        await this.datasource.transaction(async (_transactionManager) => {
            const _googleCalendarIntegrationRepo = _transactionManager.getRepository(GoogleCalendarIntegration);

            const _resetUpdateResult = await _googleCalendarIntegrationRepo.update(googleCalendarIntegrationIds, {
                setting: {
                    outboundWriteSync: false
                }
            });
            const _resetSuccess = _resetUpdateResult.affected && _resetUpdateResult.affected > 0;

            const _googleCalendarIntegration = await _googleCalendarIntegrationRepo.save(
                googleCalendarIntegrations,
                {
                    transaction: true
                }
            );

            return _resetSuccess && !!_googleCalendarIntegration;
        });

        // Resubscribe a google calendar for inbound
        const inboundGoogleCalendarIntegrations = loadedCalendars.filter((googleCalendarSettingStatus) =>
            googleCalendarSettingStatus.setting.conflictCheck === true
        );

        if (inboundGoogleCalendarIntegrations.length > 0) {
            await Promise.all(
                inboundGoogleCalendarIntegrations.map(
                    async (_inboundGoogleCalendarIntegration) =>
                        this.resubscriptionCalendar(_inboundGoogleCalendarIntegration)
                )
            );
        }

        return true;
    }

    async createGoogleCalendarEvent(
        googleIntegration: GoogleIntegration,
        googleCalendarIntegration: GoogleCalendarIntegration,
        hostTimezone: string,
        schedule: Schedule
    ): Promise<void> {

        const calendarId = googleCalendarIntegration.name;

        const userRefreshToken = googleIntegration.refreshToken;

        const ensuredOAuthClient = this.integrationUtilService.getGoogleOAuthClient(
            userRefreshToken
        );

        /**
         * TODO: PreferredTimezone should be replaced as schedule value.
         */
        const newGoogleEventBody = this.googleConverterService.convertScheduledEventToGoogleCalendarEvent(
            hostTimezone,
            schedule
        );

        const googleCalendarEventCreateService = new GoogleCalendarEventCreateService();

        await googleCalendarEventCreateService.create(
            ensuredOAuthClient,
            calendarId,
            newGoogleEventBody
        );
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

        return true;
    }

    async getGoogleCalendarSubscriptionStatus(googleChannelId: string): Promise<boolean> {
        const status = await this.integrationsRedisRepository.getGoogleCalendarSubscriptionStatus(googleChannelId);

        return status;
    }

    __patchSearchOption({
        userWorkspace,
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
            users: {
                userSetting: {
                    workspace: userWorkspace
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
}
