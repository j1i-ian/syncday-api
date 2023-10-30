import { Body, Controller, HttpCode, HttpStatus, Patch, Get, BadRequestException, Inject, Logger, InternalServerErrorException } from '@nestjs/common';
import { Observable, catchError, from, map, mergeAll, mergeMap, of, toArray } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { AuthUser } from '@decorators/auth-user.decorator';
import { CalendarIntegration } from '@interfaces/integrations/calendar-integration.interface';
import { CalendarIntegrationsServiceLocator } from '@services/integrations/calendar-integrations/calendar-integrations.service-locator.service';
import { GlobalCalendarIntegrationService } from '@services/integrations/calendar-integrations/global-calendar-integration.service';
import { CalendarIntegrationResponseDto } from '@dto/integrations/calendar-integration-response.dto';

@Controller()
export class CalendarIntegrationsController {
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly calendarIntegrationsServiceLocator: CalendarIntegrationsServiceLocator,
        private readonly globalCalendarIntegrationService: GlobalCalendarIntegrationService
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

        if (invalidOutboundCalendarUpdate) {
            throw new BadRequestException('Outbound calendar should be unique');
        }

        const patchAll$ = this.globalCalendarIntegrationService.patchAll(
            userId,
            calendarIntegrations
        );

        return from(patchAll$)
            .pipe(
                map(
                    (results) => {

                        const hasError = results.find((_result) => _result === false);

                        if (hasError) {
                            this.logger.error({
                                message: '',
                                results
                            });

                            throw new InternalServerErrorException('Unable to complete the calendar setting patch');
                        } else {
                            return true;
                        }
                    }
                ),
                catchError((error) => {
                    this.logger.error({
                        message: 'Error while calendar integration updating.',
                        calendarIntegrations,
                        error
                    });

                    if (error.message === 'Invalid credentials') {
                        return of(true);
                    } else {
                        throw error;
                    }

                })
            );
    }
}
