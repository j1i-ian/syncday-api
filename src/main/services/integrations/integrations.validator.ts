import { firstValueFrom, from, map, mergeMap, reduce } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { TooManyIntegrationRequestException } from '@exceptions/integrations/too-many-integration-request.exception';

@Injectable()
export class IntegrationsValidator {

    async validateMaxAddLimit(
        integrationsServiceLocator: IntegrationsServiceLocator,
        profileId: number
    ): Promise<void> {

        const calendarSubjectIntegrationFactories = integrationsServiceLocator.getAllCalendarSubjectIntegrationFactories();

        const allCountedCalendarSubjectIntegrations = await firstValueFrom(
            from(calendarSubjectIntegrationFactories)
                .pipe(
                    mergeMap((integration) => from(integration.count({ profileId }))),
                    reduce(
                        (acc, curr) => acc + curr,
                        0
                    )
                )
        );
        const desiredNewIntegrationNumber = 1;

        const allDesiredIntegrationNumber = allCountedCalendarSubjectIntegrations + desiredNewIntegrationNumber;

        if (
            isNaN(allCountedCalendarSubjectIntegrations) === false &&
            allDesiredIntegrationNumber > AppConfigService.INTEGRATION_MAX_ADD_LIMIT
        ) {
            throw new TooManyIntegrationRequestException();
        }
    }

    async hasOutboundCalendar(
        integrationsServiceLocator: IntegrationsServiceLocator,
        profileId: number
    ): Promise<boolean> {

        const calendarSubjectIntegrationFactories = integrationsServiceLocator.getAllCalendarSubjectIntegrationFactories();

        const hasOutboundCalendar = await firstValueFrom(
            from(calendarSubjectIntegrationFactories)
                .pipe(
                    map((integrationFactory) => integrationFactory.getCalendarIntegrationsService()),
                    mergeMap((calendarIntegrationService) => from(calendarIntegrationService.findOne({
                        profileId,
                        outboundWriteSync: true
                    }))),
                    map((outboundCalendarIntegration) => !!outboundCalendarIntegration),
                    reduce(
                        (acc, curr) => (acc || curr),
                        false
                    )
                )
        );

        return hasOutboundCalendar;
    }
}
