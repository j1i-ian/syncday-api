/* eslint-disable @typescript-eslint/no-unused-vars */
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, catchError, from, map, mergeMap, throwError } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CalendarIntegrationService } from '@interfaces/integrations/calendar-integration.abstract-service';
import { IntegrationScheduledEventsService } from '@interfaces/integrations/integration-scheduled-events.abstract-service';
import { IntegrationSearchOption } from '@interfaces/integrations/integration-search-option.interface';
import { AppleCalDAVCredential } from '@interfaces/integrations/apple/apple-cal-dav-credentials.interface';
import { SyncdayOAuth2TokenResponse } from '@interfaces/auth/syncday-oauth2-token-response.interface';
import { CoreAppleConverterService } from '@services/converters/apple/core-apple-converter.service';
import { IntegrationsFactory } from '@services/integrations/integrations.factory.interface';
import { AppleIntegrationsSchedulesService } from '@services/integrations/apple-integrations/apple-integrations-schedules/apple-integrations-schedules.service';
import { IntegrationScheduledEventsWrapperService } from '@services/integrations/integration-scheduled-events-wrapper-service.interface';
import { CalendarIntegrationWrapperService } from '@services/integrations/calendar-integration-wrapper-service.interface';
import { AppleIntegrationFacadeService } from '@services/integrations/apple-integrations/apple-integration-facade.service';
import { AppleCalendarIntegrationsService } from '@services/integrations/apple-integrations/apple-calendar-integrations/apple-calendar-integrations.service';
import { Integration } from '@entities/integrations/integration.entity';
import { AppleCalDAVIntegration } from '@entities/integrations/apple/apple-caldav-integration.entity';
import { UserSetting } from '@entities/users/user-setting.entity';
import { Profile } from '@entities/profiles/profile.entity';
import { TeamSetting } from '@entities/teams/team-setting.entity';
import { IntegrationStatus } from '@dto/integrations/integration-status.enum';
import { AlreadyIntegratedCalendarException } from '@exceptions/integrations/already-integrated-calendar.exception';

@Injectable()
export class AppleIntegrationsService implements
    IntegrationsFactory,
    IntegrationScheduledEventsWrapperService,
    CalendarIntegrationWrapperService
{

    constructor(
        private readonly coreAppleConverter: CoreAppleConverterService,
        private readonly appleIntegrationsSchedulesService: AppleIntegrationsSchedulesService,
        private readonly appleIntegrationFacade: AppleIntegrationFacadeService,
        private readonly appleCalendarIntegrationService: AppleCalendarIntegrationsService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        @InjectRepository(AppleCalDAVIntegration)
        private readonly appleCalDAVIntegrationRepository: Repository<AppleCalDAVIntegration>
    ) {}

    generateOAuth2RedirectURI(_syncdayGoogleOAuthTokenResponseOrSyncdayAccessToken?: string | SyncdayOAuth2TokenResponse | undefined): string {
        throw new Error('Method not implemented.');
    }

    validate(loadedAppleCalDAVIntegration: AppleCalDAVIntegration): Observable<boolean> {
        return from(
            this.appleIntegrationFacade.generateCalDAVClient({
                username: loadedAppleCalDAVIntegration.email,
                password: loadedAppleCalDAVIntegration.appSpecificPassword
            })
        ).pipe(
            catchError((error) => {
                this.logger.error({
                    integration: loadedAppleCalDAVIntegration,
                    error
                });

                throw error;
            }),
            map((client) => !!client)
        );
    }

    async search({
        profileId,
        withCalendarIntegrations
    }: IntegrationSearchOption): Promise<Integration[]> {

        const relations = withCalendarIntegrations ? ['appleCalDAVCalendarIntegrations'] : [];

        const loadedAppleIntegrations = await this.appleCalDAVIntegrationRepository.find({
            relations,
            where: {
                profileId
            }
        });

        return loadedAppleIntegrations.map((_loadedAppleIntegration) => _loadedAppleIntegration.toIntegration());
    }

    findOne(userSearchOption: IntegrationSearchOption): Promise<Integration | null> {
        throw new Error('Method not implemented.');
    }

    async count({
        profileId
    }: IntegrationSearchOption): Promise<number> {

        const appleIntegrationLength = await this.appleCalDAVIntegrationRepository.countBy({
            profileId
        });

        return appleIntegrationLength;
    }

    async create(
        profile: Profile,
        userSetting: UserSetting,
        teamSetting: TeamSetting,
        appleCalDAVCredential: AppleCalDAVCredential,
        timezone: string
    ): Promise<Integration> {

        const {
            username: appleId,
            password: appSpecificPassword
        } = appleCalDAVCredential;

        const loadedAppleIntegration = await this.appleCalDAVIntegrationRepository.findOneBy({
            email: appleId,
            profileId: profile.id
        });

        if (loadedAppleIntegration) {
            throw new AlreadyIntegratedCalendarException();
        }

        const client = await this.appleIntegrationFacade.generateCalDAVClient(appleCalDAVCredential);

        const calendars = await this.appleIntegrationFacade.searchCalendars(client);

        const convertedAppleCalDAVCalndarIntegrations = calendars.map(
            (_calendar) =>
                this.coreAppleConverter.convertCalDAVCalendarToAppleCalendarIntegration(
                    timezone,
                    _calendar
                )
        );

        const convertedCalendars = await Promise.all(
            convertedAppleCalDAVCalndarIntegrations
                .map(async (convertedAppleCalDAVCalndarIntegration) => {

                    const calDAVSchedules = await this.appleIntegrationFacade.searchScheduledEvents(
                        client,
                        convertedAppleCalDAVCalndarIntegration.calDavUrl
                    );

                    const convertedSchedules = calDAVSchedules.flatMap((calDAVSchedule) =>
                        this.coreAppleConverter.convertCalDAVCalendarObjectToAppleCalDAVIntegrationScheduledEvents(
                            profile,
                            userSetting,
                            teamSetting,
                            calDAVSchedule
                        )
                    );

                    convertedAppleCalDAVCalndarIntegration.appleCalDAVIntegrationScheduledEvents = convertedSchedules;

                    return convertedAppleCalDAVCalndarIntegration;
                })
        );

        const appleCalDAVIntegration = new AppleCalDAVIntegration();
        appleCalDAVIntegration.email = appleId;
        appleCalDAVIntegration.appSpecificPassword = appSpecificPassword;
        appleCalDAVIntegration.profileId = profile.id;
        appleCalDAVIntegration.appleCalDAVCalendarIntegrations = convertedCalendars;

        const creatdIntegration = await this.appleCalDAVIntegrationRepository.save(appleCalDAVIntegration);

        return creatdIntegration.toIntegration();
    }

    patch(vendorIntegrationId: number, profileId: number, partialIntegration?: Partial<AppleCalDAVIntegration> | undefined): Observable<boolean> {

        return from(
            this.appleCalDAVIntegrationRepository.findOneByOrFail({
                id: vendorIntegrationId,
                profileId
            })
        ).pipe(
            map((loadedAppleIntegration) => {

                loadedAppleIntegration.email = partialIntegration?.email ?? loadedAppleIntegration.email;
                loadedAppleIntegration.appSpecificPassword = partialIntegration?.appSpecificPassword ?? loadedAppleIntegration.appSpecificPassword;

                return loadedAppleIntegration;
            }),
            mergeMap(
                (loadedAppleIntegration) =>
                    this.validate(loadedAppleIntegration)
            ),
            catchError((errorOrException: Error) => {

                if (errorOrException.message?.trim() === 'Invalid credentials') {
                    return from(
                        this.appleCalDAVIntegrationRepository.update(
                            vendorIntegrationId,
                            {
                                status: IntegrationStatus.REVOKED
                            }
                        )
                    ).pipe(
                        mergeMap(() => throwError(() => errorOrException))
                    );
                } else {
                    throw errorOrException;
                }
            }),
            mergeMap(() =>
                from(
                    this.appleCalDAVIntegrationRepository.update(
                        vendorIntegrationId,
                        {
                            lastAppleIdAccessAt: new Date(),
                            email: partialIntegration?.email,
                            appSpecificPassword: partialIntegration?.appSpecificPassword
                        }
                    )
                ).pipe(
                    map(
                        (updateResult) =>
                            !!(
                                updateResult &&
                                updateResult.affected &&
                                updateResult.affected > 0
                            )
                    )
                )
            )
        );
    }

    async remove(vendorIntegrationId: number, profileId: number): Promise<boolean> {

        const deleteResult = await this.appleCalDAVIntegrationRepository.delete({
            id: vendorIntegrationId,
            profileId
        });

        const isSuccess =
            deleteResult && deleteResult.affected && deleteResult.affected > 0 ?
                true :
                false;

        return isSuccess;
    }

    getIntegrationScheduledEventsService(): IntegrationScheduledEventsService {
        return this.appleIntegrationsSchedulesService;
    }

    getCalendarIntegrationsService(): CalendarIntegrationService {
        return this.appleCalendarIntegrationService;
    }

}
