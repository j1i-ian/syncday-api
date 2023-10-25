import { Body, Controller, HttpCode, HttpStatus, Patch, Get, BadRequestException, Inject, Logger } from '@nestjs/common';
import { Observable, catchError, from, map, mergeAll, mergeMap, of, toArray } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { AuthUser } from '@decorators/auth-user.decorator';
import { CalendarIntegration } from '@interfaces/integrations/calendar-integration.interface';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';
import { CalendarIntegrationResponseDto } from '@dto/integrations/calendar-integration-response.dto';

@Controller()
export class CalendarIntegrationsController {
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly calendarIntegrationsServiceLocator: CalendarIntegrationsServiceLocator
    ) {}

    @Get()
    searchAllCalendarIntegrations(
        @AuthUser('id') userId: number
    ): Observable<CalendarIntegration[]> {

        const calendarIntegrationsServices = this.calendarIntegrationsServiceLocator.getAllCalendarIntegrationServices();

        return from(calendarIntegrationsServices)
            .pipe(
                mergeMap((calendarIntegrationsService) => calendarIntegrationsService.search({
                    userId
                })),
                mergeAll(),
                toArray(),
                map((_calendarsArray) =>
                    _calendarsArray.flatMap((__calendarIntegrations) => __calendarIntegrations)
                        .map(
                            (__calendarIntegration) => plainToInstance(
                                CalendarIntegrationResponseDto,
                                __calendarIntegration.toCalendarIntegration(), {
                                    excludeExtraneousValues: true
                                }
                            )
                        )
                )
            )
        ;
    }

    @Patch()
    @HttpCode(HttpStatus.NO_CONTENT)
    patchAllCalendarIntegrations(
        @AuthUser('id') userId: number,
        @Body() calendarIntegrations: CalendarIntegration[]
    ): Observable<boolean> {

        // When user requests multiple outbounds it is considered as exception
        // but in the future we should remove exception after multiple outbound implement
        const requestedOutboundCalendars = calendarIntegrations.filter((_calIntegration) => _calIntegration.setting.outboundWriteSync === true);
        const invalidOutboundCalendarUpdate = requestedOutboundCalendars.length > 1;
        const hasOutboundUpdate = requestedOutboundCalendars.length > 0;

        if (invalidOutboundCalendarUpdate) {
            throw new BadRequestException('Outbound calendar should be unique');
        }

        const calendarIntegrationsServices = this.calendarIntegrationsServiceLocator.getAllCalendarIntegrationServices();

        return from(calendarIntegrationsServices)
            .pipe(
                mergeMap((calendarIntegrationsService) => {

                    const _vendor = calendarIntegrationsService.getIntegrationVendor();

                    const _filteredCalendars = calendarIntegrations.filter(
                        (_calIntegration) => _calIntegration.vendor === _vendor
                    );

                    if (hasOutboundUpdate || _filteredCalendars.length > 0) {
                        return calendarIntegrationsService.patch(
                            userId,
                            _filteredCalendars
                        );
                    } else {
                        return of(true);
                    }
                }),
                catchError((error) => {
                    this.logger.error({
                        message: 'Error while calendar integration updating.',
                        calendarIntegrations,
                        error
                    });

                    throw error;
                })
            );
    }
}
