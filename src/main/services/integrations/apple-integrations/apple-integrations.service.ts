/* eslint-disable @typescript-eslint/no-unused-vars */
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, catchError, from, map, mergeMap, throwError } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { IntegrationSchedulesService } from '@core/interfaces/integrations/integration-schedules.abstract-service';
import { CalendarIntegrationService } from '@core/interfaces/integrations/calendar-integration.abstract-service';
import { IntegrationSearchOption } from '@interfaces/integrations/integration-search-option.interface';
import { AppleCalDAVCredential } from '@interfaces/integrations/apple/apple-cal-dav-credentials.interface';
import { IntegrationsFactory } from '@services/integrations/integrations.factory.interface';
import { AppleConverterService } from '@services/integrations/apple-integrations/apple-converter/apple-converter.service';
import { AppleIntegrationsSchedulesService } from '@services/integrations/apple-integrations/apple-integrations-schedules/apple-integrations-schedules.service';
import { IntegrationScheduleWrapperService } from '@services/integrations/integration-schedule-wrapper-service.interface';
import { CalendarIntegrationWrapperService } from '@services/integrations/calendar-integration-wrapper-service.interface';
import { AppleIntegrationFacadeService } from '@services/integrations/apple-integrations/apple-integration-facade.service';
import { AppleCalendarIntegrationsService } from '@services/integrations/apple-integrations/apple-calendar-integrations/apple-calendar-integrations.service';
import { Integration } from '@entity/integrations/integration.entity';
import { User } from '@entity/users/user.entity';
import { AppleCalDAVIntegration } from '@entity/integrations/apple/apple-caldav-integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { IntegrationStatus } from '@dto/integrations/integration-status.enum';
import { SyncdayGoogleOAuthTokenResponse } from '@app/interfaces/auth/syncday-google-oauth-token-response.interface';
import { AlreadyIntegratedCalendarException } from '@app/exceptions/integrations/already-integrated-calendar.exception';

@Injectable()
export class AppleIntegrationsService implements
    IntegrationsFactory,
    IntegrationScheduleWrapperService,
    CalendarIntegrationWrapperService
{

    constructor(
        private readonly appleConverter: AppleConverterService,
        private readonly appleIntegrationsSchedulesService: AppleIntegrationsSchedulesService,
        private readonly appleIntegrationFacade: AppleIntegrationFacadeService,
        private readonly appleCalendarIntegrationService: AppleCalendarIntegrationsService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        @InjectRepository(AppleCalDAVIntegration)
        private readonly appleCalDAVIntegrationRepository: Repository<AppleCalDAVIntegration>
    ) {}

    generateOAuth2RedirectURI(_syncdayGoogleOAuthTokenResponseOrSyncdayAccessToken?: string | SyncdayGoogleOAuthTokenResponse | undefined): string {
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
        userId,
        withCalendarIntegrations
    }: IntegrationSearchOption): Promise<Integration[]> {

        const relations = withCalendarIntegrations ? ['appleCalDAVCalendarIntegrations'] : [];

        const loadedAppleIntegrations = await this.appleCalDAVIntegrationRepository.find({
            relations,
            where: {
                userId
            }
        });

        return loadedAppleIntegrations.map((_loadedAppleIntegration) => _loadedAppleIntegration.toIntegration());
    }

    findOne(userSearchOption: IntegrationSearchOption): Promise<Integration | null> {
        throw new Error('Method not implemented.');
    }

    async count({
        userId
    }: IntegrationSearchOption): Promise<number> {

        const appleIntegrationLength = await this.appleCalDAVIntegrationRepository.countBy({
            userId
        });

        return appleIntegrationLength;
    }

    async create(
        user: User,
        userSetting: UserSetting,
        appleCalDAVCredential: AppleCalDAVCredential,
        timezone: string
    ): Promise<Integration> {

        const {
            username: appleId,
            password: appSpecificPassword
        } = appleCalDAVCredential;

        const loadedAppleIntegration = await this.appleCalDAVIntegrationRepository.findOneBy({
            email: appleId,
            userId: user.id
        });

        if (loadedAppleIntegration) {
            throw new AlreadyIntegratedCalendarException();
        }

        const client = await this.appleIntegrationFacade.generateCalDAVClient(appleCalDAVCredential);

        const calendars = await this.appleIntegrationFacade.searchCalendars(client);

        const convertedAppleCalDAVCalndarIntegrations = calendars.map(
            (_calendar) =>
                this.appleConverter.convertCalDAVCalendarToAppleCalendarIntegration(
                    timezone,
                    _calendar
                )
        );

        const convertedCalendars = await Promise.all(
            convertedAppleCalDAVCalndarIntegrations
                .map(async (convertedAppleCalDAVCalndarIntegration) => {

                    const calDAVSchedules = await this.appleIntegrationFacade.searchSchedules(
                        client,
                        convertedAppleCalDAVCalndarIntegration.calDavUrl
                    );

                    const convertedSchedules = calDAVSchedules.flatMap((calDAVSchedule) =>
                        this.appleConverter.convertCalDAVCalendarObjectToAppleCalDAVIntegrationSchedules(
                            user,
                            userSetting,
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

    patch(vendorIntegrationId: number, userId: number, partialIntegration?: Partial<AppleCalDAVIntegration> | undefined): Observable<boolean> {

        return from(
            this.appleCalDAVIntegrationRepository.findOneByOrFail({
                id: vendorIntegrationId,
                userId
            })
        ).pipe(
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

    getCalendarIntegrationsService(): CalendarIntegrationService {
        return this.appleCalendarIntegrationService;
    }

}
