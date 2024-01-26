import { Injectable } from '@nestjs/common';
import { ConferenceLinkIntegrationService } from '@interfaces/integrations/conference-link-integration.abstract-service';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { ZoomCreateMeetingResponseDTO } from '@interfaces/integrations/zoom/zoom-create-meeting-response.interface';
import { MeetingType } from '@interfaces/integrations/zoom/enum/meeting-type.enum';
import { ZoomIntegrationFacade } from '@services/integrations/zoom-integrations/zoom-integrations.facade';
import { ConferenceLink } from '@entities/scheduled-events/conference-link.entity';
import { Contact } from '@entities/events/contact.entity';
import { ZoomIntegration } from '@entities/integrations/zoom/zoom-integration.entity';
import { ScheduledEvent } from '@entities/scheduled-events/scheduled-event.entity';

@Injectable()
export class ZoomConferenceLinkIntegrationsService implements ConferenceLinkIntegrationService {

    constructor(private readonly zoomIntegrationFacade: ZoomIntegrationFacade) {}

    async createMeeting(
        integration: ZoomIntegration,
        contacts: Contact[],
        scheduledEvent: ScheduledEvent,
        timezone: string
    ): Promise<ConferenceLink | null> {

        const shouldGenerateLink = contacts.find((_contact) => _contact.type === ContactType.ZOOM);

        let generatedConferenceLink = null;

        if (shouldGenerateLink) {

            const { refreshToken } = integration;

            const oauth2UserToken = await this.zoomIntegrationFacade.issueTokenByRefreshToken(refreshToken);

            const createdZoomMeeting = await this.zoomIntegrationFacade.createMeeting(oauth2UserToken.accessToken, {
                agenda: scheduledEvent.name,
                default_password: false,
                duration: '2',
                timezone,
                type: MeetingType.Scheduled,
                topic: scheduledEvent.name,
                start_time: scheduledEvent.scheduledTime.startTimestamp
            });

            generatedConferenceLink = this.getConferenceLinkFromVendorCalendarEvent(createdZoomMeeting);
        }

        return generatedConferenceLink;
    }

    getConferenceLinkFromVendorCalendarEvent(createdZoomMeeting: ZoomCreateMeetingResponseDTO): ConferenceLink {

        const convertedConferenceLink: ConferenceLink = {
            type: IntegrationVendor.ZOOM,
            serviceName: 'Zoom',
            link: createdZoomMeeting.join_url
        };

        return convertedConferenceLink;
    }

    getIntegrationVendor(): IntegrationVendor {
        return IntegrationVendor.ZOOM;
    }
}
