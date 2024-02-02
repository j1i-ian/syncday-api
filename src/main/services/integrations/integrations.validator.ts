import { defer, firstValueFrom, from, map, mergeMap, reduce, tap } from 'rxjs';
import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { TooManyIntegrationRequestException } from '@exceptions/integrations/too-many-integration-request.exception';

@Injectable()
export class IntegrationsValidator {

    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger;

    async validateMaxAddLimit(
        integrationsServiceLocator: IntegrationsServiceLocator,
        profileId: number
    ): Promise<void> {

        const calendarSubjectIntegrationFactories = integrationsServiceLocator.getAllCalendarSubjectIntegrationFactories();

        const allCountedCalendarSubjectIntegrations = await firstValueFrom(
            from(calendarSubjectIntegrationFactories)
                .pipe(
                    mergeMap((integration) => defer(() => from(integration.count({ profileId })))),
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
                    mergeMap((calendarIntegrationService) => defer(() => from(calendarIntegrationService.findOne({
                        profileId,
                        outboundWriteSync: true
                    })))),
                    tap((outboundCalendarIntegration) => {

                        const outboundCalendarIntegrationId = outboundCalendarIntegration?.id;

                        this.logger.debug({
                            message: `finding outbound calendar integrations ... ${String(outboundCalendarIntegrationId)}`
                        });
                    }),
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
