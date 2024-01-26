import { Module } from '@nestjs/common';
import { AppleIntegrationFacadeService } from '@services/integrations/apple-integrations/apple-integration-facade.service';
import { AppleCaldavClientService } from '@services/integrations/apple-integrations/facades/apple-caldav-client.service';
import { AppleCalendarListService } from '@services/integrations/apple-integrations/facades/apple-calendar-list.service';
import { AppleCalendarEventListService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-list.service';
import { AppleCalendarEventCreateService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-create.service';
import { AppleCalendarEventPatchService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-patch.service';

@Module({
    providers: [
        AppleIntegrationFacadeService,
        AppleCaldavClientService,
        AppleCalendarListService,
        AppleCalendarEventListService,
        AppleCalendarEventCreateService,
        AppleCalendarEventPatchService
    ],
    exports: [
        AppleIntegrationFacadeService,
        AppleCaldavClientService,
        AppleCalendarListService,
        AppleCalendarEventListService,
        AppleCalendarEventCreateService,
        AppleCalendarEventPatchService
    ]
})
export class AppleIntegrationFacadeModule {}
