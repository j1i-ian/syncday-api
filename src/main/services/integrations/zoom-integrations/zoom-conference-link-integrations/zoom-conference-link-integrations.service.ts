import { Injectable } from '@nestjs/common';
import { ConferenceLinkIntegrationService } from '@core/interfaces/integrations/conference-link-integration.abstract-service';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { ZoomIntegrationFacade } from '@services/integrations/zoom-integrations/zoom-integrations.facade';
import { ConferenceLink } from '@entity/schedules/conference-link.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { Contact } from '@entity/events/contact.entity';
import { ZoomIntegration } from '@entity/integrations/zoom/zoom-integration.entity';
import { ZoomCreateMeetingResponseDTO } from '@app/interfaces/integrations/zoom/zoom-create-meeting-response.interface';
import { MeetingType } from '@app/interfaces/integrations/zoom/enum/meeting-type.enum';

@Injectable()
export class ZoomConferenceLinkIntegrationsService implements ConferenceLinkIntegrationService {

    constructor(private readonly zoomIntegrationFacade: ZoomIntegrationFacade) {}

    async createMeeting(
        integration: ZoomIntegration,
        contacts: Contact[],
        schedule: Schedule,
        timezone: string
    ): Promise<ConferenceLink | null> {

        const shouldGenerateLink = contacts.find((_contact) => _contact.type === ContactType.ZOOM);

        let generatedConferenceLink = null;

        if (shouldGenerateLink) {

            const { refreshToken } = integration;

            const oauth2UserToken = await this.zoomIntegrationFacade.issueTokenByRefreshToken(refreshToken);

            const createdZoomMeeting = await this.zoomIntegrationFacade.createMeeting(oauth2UserToken.accessToken, {
                agenda: schedule.name,
                default_password: false,
                duration: '2',
                timezone,
                type: MeetingType.Scheduled,
                topic: schedule.name,
                start_time: schedule.scheduledTime.startTimestamp
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
