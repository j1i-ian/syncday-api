import { firstValueFrom, from, mergeMap, reduce } from 'rxjs';
import { Injectable } from '@nestjs/common';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { TooManyIntegrationRequestException } from '@exceptions/integrations/too-many-integration-request.exception';

@Injectable()
export class IntegrationsValidator {

    async validateMaxAddLimit(
        integrationsServiceLocator: IntegrationsServiceLocator,
        userId: number
    ): Promise<void> {

        const calendarSubjectIntegrationFactories = integrationsServiceLocator.getAllCalendarSubjectIntegrationFactories();

        const allCountedCalendarSubjectIntegrations = await firstValueFrom(
            from(calendarSubjectIntegrationFactories)
                .pipe(
                    mergeMap((integration) => from(integration.count({ userId }))),
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
}
