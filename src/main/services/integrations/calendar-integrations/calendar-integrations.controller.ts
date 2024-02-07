import { Body, Controller, HttpCode, HttpStatus, Patch, Get, BadRequestException, Inject, InternalServerErrorException } from '@nestjs/common';
import { Observable, catchError, from, map, mergeAll, mergeMap, of, toArray } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AuthProfile } from '@decorators/auth-profile.decorator';
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
        @AuthProfile('id') profileId: number
    ): Observable<CalendarIntegration[]> {

        const calendarIntegrationsServices = this.calendarIntegrationsServiceLocator.getAllCalendarIntegrationServices();

        return from(calendarIntegrationsServices)
            .pipe(
                mergeMap((calendarIntegrationsService) => calendarIntegrationsService.search({
                    profileId
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
        @AuthProfile('id') profileId: number,
        @Body() calendarIntegrations: CalendarIntegration[]
    ): Observable<boolean> {

        this.logger.info({
            message: 'Patching all calendar integrations',
            profileId
        });

        // When user requests multiple outbounds it is considered as exception
        // but in the future we should remove exception after multiple outbound implement
        const requestedOutboundCalendars = calendarIntegrations.filter((_calIntegration) => _calIntegration.setting.outboundWriteSync === true);
        const invalidOutboundCalendarUpdate = requestedOutboundCalendars.length > 1;
        const hasOutboundUpdate = requestedOutboundCalendars.length > 0;

        if (invalidOutboundCalendarUpdate) {
            throw new BadRequestException('Outbound calendar should be unique');
        }

        this.logger.info({
            message: 'Calendar update request validation is passed',
            profileId,
            requestedOutboundCalendarsLength: requestedOutboundCalendars.length
        });

        const calendarIntegrationsServices = this.calendarIntegrationsServiceLocator.getAllCalendarIntegrationServices();

        this.logger.info({
            message: 'Start calendar updating stream',
            profileId
        });

        return from(calendarIntegrationsServices)
            .pipe(
                mergeMap((calendarIntegrationsService) => {

                    const _vendor = calendarIntegrationsService.getIntegrationVendor();

                    const _filteredCalendars = calendarIntegrations.filter(
                        (_calIntegration) => _calIntegration.vendor === _vendor
                    );

                    const shouldPatch = hasOutboundUpdate || _filteredCalendars.length > 0;

                    this.logger.info({
                        message: 'Trying to patch all calendar integration',
                        profileId,
                        _vendor,
                        _filteredCalendarsLength: _filteredCalendars.length,
                        calendarIntegrationsServiceName: calendarIntegrationsService.constructor.name
                    });

                    if (shouldPatch) {
                        return calendarIntegrationsService.patchAll(
                            profileId,
                            _filteredCalendars
                        );
                    } else {
                        return of(true);
                    }
                }),
                toArray(),
                map(
                    (results) => {

                        const hasError = results.find((_result) => _result === false);

                        if (hasError) {
                            this.logger.error({
                                message: 'Unable to complete the calendar setting patch',
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
