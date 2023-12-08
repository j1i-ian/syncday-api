import { BadRequestException, Injectable } from '@nestjs/common';
import { Repository, FindOptionsWhere, DataSource, In, EntityManager } from 'typeorm';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Observable, firstValueFrom, from } from 'rxjs';
import { CalendarIntegrationService } from '@core/interfaces/integrations/calendar-integration.abstract-service';
import { CreatedCalendarEvent } from '@core/interfaces/integrations/created-calendar-event.interface';
import { CalendarIntegrationSearchOption } from '@interfaces/integrations/calendar-integration-search-option.interface';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { AppleIntegrationFacadeService } from '@services/integrations/apple-integrations/apple-integration-facade.service';
import { AppleConverterService } from '@services/integrations/apple-integrations/apple-converter/apple-converter.service';
import { AppleCalDAVCalendarIntegration } from '@entity/integrations/apple/apple-caldav-calendar-integration.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { AppleCalDAVIntegration } from '@entity/integrations/apple/apple-caldav-integration.entity';
import { CalendarIntegration } from '@entity/calendars/calendar-integration.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';

@Injectable()
export class AppleCalendarIntegrationsService extends CalendarIntegrationService {

    constructor(
        private readonly appleIntegrationFacade: AppleIntegrationFacadeService,
        private readonly appleConverter: AppleConverterService,
        @InjectDataSource() private readonly datasource: DataSource,
        @InjectRepository(AppleCalDAVCalendarIntegration)
        private readonly appleCalDAVCalendarIntegrationRepository: Repository<AppleCalDAVCalendarIntegration>
    ) {
        super();
    }

    getCalendarIntegrationRepository(): Repository<AppleCalDAVCalendarIntegration> {
        return this.appleCalDAVCalendarIntegrationRepository;
    }

    getProfileRelationConditions(
        userId: number,
        options: FindOptionsWhere<CalendarIntegration>
    ): FindOptionsWhere<CalendarIntegration> {
        return {
            ...options,
            appleCalDAVIntegration: {
                userId
            }
        } as FindOptionsWhere<AppleCalDAVCalendarIntegration> as FindOptionsWhere<CalendarIntegration>;
    }

    async _synchronizeWithCalDAVCalendars(
        manager: EntityManager,
        integration: AppleCalDAVIntegration,
        calendarIntegration: AppleCalDAVCalendarIntegration,
        profile: Profile,
        userSetting: UserSetting,
        teamSetting: TeamSetting
    ): Promise<void> {

        const client = await this.appleIntegrationFacade.generateCalDAVClient({
            username: integration.email,
            password: integration.appSpecificPassword
        });

        const calDAVSchedules = await this.appleIntegrationFacade.searchSchedules(
            client,
            calendarIntegration.calDavUrl
        );

        const schedules = calDAVSchedules.flatMap((_calDAVSchedule) =>
            this.appleConverter.convertCalDAVCalendarObjectToAppleCalDAVIntegrationSchedules(
                profile,
                userSetting,
                teamSetting,
                _calDAVSchedule
            )
        );
        const iCalUIDs = schedules.map((_schedule) => _schedule.iCalUID);

        const appleCalDAVIntegrationScheduleRepository = manager.getRepository(AppleCalDAVIntegrationSchedule);

        const remainedSchedules = await appleCalDAVIntegrationScheduleRepository.findBy({
            iCalUID: In(iCalUIDs),
            appleCalDAVCalendarIntegrationId: calendarIntegration.id
        });
        const remainedScheduleMap = new Map(
            remainedSchedules.map(
                (_remainedSchedule) =>
                    [_remainedSchedule.iCalUID, _remainedSchedule]
            )
        );

        const newSchedules = schedules.filter((_schedule) =>
            remainedScheduleMap.has(_schedule.iCalUID) === false
        ).map((_filteredNewSchedule) => {
            _filteredNewSchedule.appleCalDAVCalendarIntegrationId = calendarIntegration.id;
            return _filteredNewSchedule;
        });

        await appleCalDAVIntegrationScheduleRepository.save(newSchedules);
    }

    findOne(searchOptions: Partial<CalendarIntegrationSearchOption>): Observable<CalendarIntegration | null> {

        const options = this.__patchSearchOption(searchOptions);

        return from(
            this.appleCalDAVCalendarIntegrationRepository.findOne({
                relations: [
                    'appleCalDAVIntegration',
                    'appleCalDAVIntegration.user',
                    'appleCalDAVIntegration.user.userSetting'
                ],
                where: options
            })
        );
    }

    patch(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        userId: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        calendarIntegration: Partial<CalendarIntegration> & Pick<CalendarIntegration, 'id' | 'setting'>
    ): Promise<boolean> {
        throw new Error('Method not implemented.');
    }

    async patchAll(
        profileId: number,
        calendarIntegrations: Array<Partial<CalendarIntegration> & Pick<CalendarIntegration, 'id' | 'setting'>>
    ): Promise<boolean> {

        const calendarIntegrationIds = calendarIntegrations.map(
            (_calendarIntegration) => _calendarIntegration.id
        );

        const calendarIntegrationRepository = this.getCalendarIntegrationRepository();
        // check owner permission
        const loadedCalendarIntegrations = await calendarIntegrationRepository.find({
            relations: [
                'appleCalDAVIntegration',
                'appleCalDAVIntegration.profile',
                'appleCalDAVIntegration.profile.user',
                'appleCalDAVIntegration.profile.user.userSetting',
                'appleCalDAVIntegration.profile.team',
                'appleCalDAVIntegration.profile.team.teamSetting'
            ],
            where: {
                appleCalDAVIntegration: {
                    profileId
                }
            }
        });
        const loadedCalendarIds = loadedCalendarIntegrations.map((_loadedCalendar) => _loadedCalendar.id);

        // validate that request user has a permission
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
            const _calendarIntegrationRepository = _transactionManager.getRepository(AppleCalDAVCalendarIntegration);
            const _integrationScheduleRepository = _transactionManager.getRepository(AppleCalDAVIntegrationSchedule);

            const _outboundResetSuccess = await firstValueFrom(this._resetOutboundSetting(
                _transactionManager,
                profileId
            ));

            const _resultToDeleteSchedules = await _integrationScheduleRepository.delete({
                appleCalDAVCalendarIntegrationId: In(calendarIdsToDeleteSchedules)
            });

            const _resultToDeleteSchedulesSuccess = _resultToDeleteSchedules.affected && _resultToDeleteSchedules.affected > 0;

            const _calendarIntegrations = await _calendarIntegrationRepository.save(
                calendarIntegrations,
                {
                    transaction: true
                }
            );

            const _inboundCalendarIntegrations = loadedCalendarIntegrations
                .filter((_loadedCalendarIntegration) =>
                    _calendarIntegrations.find(
                        (__calendarIntegration) => __calendarIntegration.id === _loadedCalendarIntegration.id
                    )
                ).filter((calendarSettingStatus) =>
                    calendarSettingStatus.setting.conflictCheck === true
                );

            if (_inboundCalendarIntegrations.length > 0) {

                await Promise.all(
                    _inboundCalendarIntegrations
                        .map(
                            async (__inboundCalendarIntegration) => {

                                const appleCalDAVIntegration = __inboundCalendarIntegration.appleCalDAVIntegration;
                                const profile = appleCalDAVIntegration.profile;
                                const { user, team } = profile;
                                const { userSetting } = user;
                                const { teamSetting } = team;

                                await this._synchronizeWithCalDAVCalendars(
                                    _transactionManager,
                                    appleCalDAVIntegration,
                                    __inboundCalendarIntegration,
                                    profile,
                                    userSetting,
                                    teamSetting
                                );

                                return;
                            }
                        )
                );
            }

            return _outboundResetSuccess && _resultToDeleteSchedulesSuccess && _calendarIntegrations.length > 0;
        });

        return true;

    }

    async createCalendarEvent(
        integration: AppleCalDAVIntegration,
        calendarIntegration: AppleCalDAVCalendarIntegration,
        availabilityTimezone: string,
        patchedSchedule: Schedule
    ): Promise<CreatedCalendarEvent> {

        const abstractedIntegration = integration.toIntegration();

        let createdCalendarEvent: CreatedCalendarEvent;

        if (abstractedIntegration.vendor === IntegrationVendor.APPLE) {
            const client = await this.appleIntegrationFacade.generateCalDAVClient({
                username: integration.email,
                password: integration.appSpecificPassword
            });

            createdCalendarEvent = await this.appleIntegrationFacade.createCalendarEvent(
                client,
                calendarIntegration.calDavUrl,
                patchedSchedule
            );

        } else {
            throw new BadRequestException('Bad calendar event creating request');
        }

        return createdCalendarEvent;
    }

    async patchCalendarEvent(
        integration: AppleCalDAVIntegration,
        _calendarIntegration: AppleCalDAVCalendarIntegration,
        patchedSchedule: Schedule,
        calendarEvent: CreatedCalendarEvent
    ): Promise<boolean> {

        const client = await this.appleIntegrationFacade.generateCalDAVClient({
            username: integration.email,
            password: integration.appSpecificPassword
        });

        const updateSuccess = await this.appleIntegrationFacade.updateCalendarEvent(
            client,
            calendarEvent.generatedEventUrl,
            patchedSchedule
        );

        return updateSuccess;
    }

    __patchSearchOption({
        profileId,
        profileUUID,
        teamWorkspace,
        calendarIntegrationUUID,
        conflictCheck,
        outboundWriteSync
    }: Partial<CalendarIntegrationSearchOption> = {}):
        FindOptionsWhere<CalendarIntegration> |
        Array<FindOptionsWhere<CalendarIntegration>> {
        const options: FindOptionsWhere<AppleCalDAVCalendarIntegration> | Array<FindOptionsWhere<AppleCalDAVCalendarIntegration>> = {
            uuid: calendarIntegrationUUID,
            setting: {
                conflictCheck,
                outboundWriteSync
            },
            appleCalDAVIntegration: {
                profile: {
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

        return options;
    }

    getIntegrationProfileRelationPath(integrationAlias = 'integration'): string {
        return `${integrationAlias}.user`;
    }

    getIntegrationIdAlias(): string {
        return 'appleCalDAVIntegrationId';
    }

    getIntegrationEntity(): new () => AppleCalDAVIntegration {
        return AppleCalDAVIntegration;
    }

    getCalendarIntegrationEntity(): new () => AppleCalDAVCalendarIntegration {
        return AppleCalDAVCalendarIntegration;
    }

    getIntegrationVendor(): IntegrationVendor {
        return IntegrationVendor.APPLE;
    }
}
