import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { concatMap, firstValueFrom, forkJoin, from, map, of, take, tap, toArray } from 'rxjs';
import { CalendarIntegrationService } from '@core/interfaces/integrations/calendar-integration.abstract-service';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';
import { CalendarIntegration } from '@entity/calendars/calendar-integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { User } from '@entity/users/user.entity';

@Injectable()
export class GlobalCalendarIntegrationService {

    constructor(
        private readonly calendarIntegrationsServiceLocator: CalendarIntegrationsServiceLocator,
        @InjectDataSource() private readonly datasource: DataSource

    ) {}

    async patchAll(
        userId: number,
        calendarIntegrations:
        Array<Partial<CalendarIntegration> & Pick<CalendarIntegration, 'id' | 'setting'>>
    ): Promise<boolean[]> {

        const calendarIntegrationsServices = this.calendarIntegrationsServiceLocator.getAllCalendarIntegrationServices();
        const calendarIntegrationsServices$ = from(calendarIntegrationsServices);

        const patchedCalendarsWithServices$ = calendarIntegrationsServices$.pipe(
            concatMap((calendarIntegrationsService) =>
                calendarIntegrationsService.find({ userId })
                    .pipe(
                        map((loadedCalendars) => {
                            const vendorCalendarIntegrations =
                                calendarIntegrations.filter(
                                    (_calendarIntegration) =>
                                        _calendarIntegration.vendor === calendarIntegrationsService.getIntegrationVendor()
                                );

                            return [
                                vendorCalendarIntegrations,
                                loadedCalendars
                            ] as [
                                CalendarIntegration[],
                                CalendarIntegration[]
                            ];
                        }),
                        tap(([
                            vendorCalendarIntegrations,
                            loadedCalendars
                        ]) => {
                            calendarIntegrationsService.validate(
                                vendorCalendarIntegrations,
                                loadedCalendars
                            );
                        }),
                        map(([
                            vendorCalendarIntegrations,
                            loadedCalendars
                        ]) => {

                            // It is more cost-effective to update already loaded calendars than to execute an SQL query with relation join
                            const updatedCalendars = loadedCalendars.map((_loadedCalendar) => {
                                const _calendarIntegration =
                                    vendorCalendarIntegrations.find((_calendarIntegration) => _calendarIntegration.id === _loadedCalendar.id);

                                if (_calendarIntegration) {
                                    _loadedCalendar.setting = _calendarIntegration?.setting;
                                }

                                return _loadedCalendar;
                            });

                            const loadedUser = calendarIntegrationsService.getUserFromCalendarIntegration(loadedCalendars[0] );
                            const loadedUserSetting = loadedUser.userSetting;

                            return [
                                calendarIntegrationsService,
                                updatedCalendars,
                                loadedUser,
                                loadedUserSetting
                            ] as [CalendarIntegrationService, CalendarIntegration[], User, UserSetting];
                        })
                    )
            )
        );

        return this.datasource.transaction(async (_transactionManager) => {

            const resetOutboundSettings$ = calendarIntegrationsServices$.pipe(
                take(1),
                concatMap((calendarIntegrationsService) =>
                    calendarIntegrationsService._resetOutboundSetting(
                        _transactionManager,
                        userId
                    )
                ),
                toArray()
            );

            const results = await firstValueFrom(
                forkJoin({
                    reset: resetOutboundSettings$,
                    patch: patchedCalendarsWithServices$
                })
                    .pipe(
                        map(({ patch })=> patch),
                        concatMap(
                            ([
                                calendarIntegrationsService,
                                updatedCalendars,
                                loadedUser,
                                loadedUserSetting
                            ]) =>
                                from(updatedCalendars)
                                    .pipe(
                                        concatMap(
                                            (_calendarIntegration) => _calendarIntegration.setting.conflictCheck === true ?
                                                from(calendarIntegrationsService.synchronize(
                                                    _transactionManager,
                                                    loadedUser,
                                                    loadedUserSetting,
                                                    _calendarIntegration.getIntegration(),
                                                    _calendarIntegration
                                                )) :
                                                of(true)
                                        )
                                    )
                        ),
                        toArray()
                    )
            );

            return results;
        });

    }
}
