import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Observable, from, map, mergeAll, mergeMap, toArray } from 'rxjs';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { IntegrationSubject } from '@interfaces/integrations/integration-subject.enum';
import { IntegrationsServiceLocator } from '@services/integrations/integrations.service-locator.service';
import { Integration } from '@entity/integrations/integration.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { ValidateQueryParamPipe } from '@app/pipes/validate-query-param/validate-query-param.pipe';

@Controller()
export class IntegrationsController {

    constructor(
        private readonly integrationsServiceLocator: IntegrationsServiceLocator
    ) {}

    @Get()
    fetchAllIntegrations(
        @AuthProfile() authProfile: Profile,
        @Query('subject', ValidateQueryParamPipe) integrationSubject: IntegrationSubject,
        @Query('withCalendarIntegrations') withCalendarIntegrations: string | boolean
    ): Observable<Integration[]> {

        const ensuredWithCalendarIntegrations = withCalendarIntegrations === 'true' || withCalendarIntegrations === true;

        if (integrationSubject === IntegrationSubject.CALENDAR) {
            const calendarSubjectIntegrationFactories = this.integrationsServiceLocator.getAllCalendarSubjectIntegrationFactories();

            return from(calendarSubjectIntegrationFactories)
                .pipe(
                    mergeMap(
                        (calendarSubjectIntegrationFactory) => calendarSubjectIntegrationFactory.search({
                            profileId: authProfile.id,
                            profileUUID: authProfile.uuid,
                            withCalendarIntegrations: ensuredWithCalendarIntegrations
                        })
                    ),
                    mergeAll(),
                    toArray(),
                    map((_integrationArray) =>
                        _integrationArray.flatMap(((_integrations) => _integrations))
                            .sort(
                                (aIntegration, bIntegration) =>
                                    aIntegration.createdDate.getTime() -
                                    bIntegration.createdDate.getTime()
                            )
                    )
                );
        } else {
            throw new BadRequestException('Not yet supported subject');
        }
    }
}
