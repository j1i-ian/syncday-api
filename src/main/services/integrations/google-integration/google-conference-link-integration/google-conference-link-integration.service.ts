import { Injectable } from '@nestjs/common';
import { calendar_v3 } from 'googleapis';
import { ConferenceLinkIntegrationService } from '@core/interfaces/integrations/conference-link-integration.abstract-service';
import { CreatedCalendarEvent } from '@core/interfaces/integrations/created-calendar-event.interface';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { Contact } from '@entity/events/contact.entity';
import { Integration } from '@entity/integrations/integration.entity';
import { ConferenceLink } from '@entity/scheduled-events/conference-link.entity';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';

@Injectable()
export class GoogleConferenceLinkIntegrationService implements ConferenceLinkIntegrationService {

    /**
     * We need to check whether only the Google Meet Link can be issued in the future.
     *
     * @param _integration
     * @param contacts
     * @returns
     */
    createMeeting(
        _integration: Integration,
        contacts: Contact[],
        _scheduledEvent: ScheduledEvent,
        _timezone: string,
        createdCalendarEvent: (CreatedCalendarEvent & { raw: calendar_v3.Schema$Event }) | null
    ): Promise<ConferenceLink | null> {

        if (!createdCalendarEvent) {
            return Promise.resolve(null);
        }

        const { raw } = createdCalendarEvent;

        const shouldGenerateLink = contacts.find((_contact) => _contact.type === ContactType.GOOGLE_MEET);

        let generatedConferenceLink = null;

        if (shouldGenerateLink && raw) {
            generatedConferenceLink = this.getConferenceLinkFromVendorCalendarEvent(raw);
        }

        return Promise.resolve(generatedConferenceLink);
    }

    getConferenceLinkFromVendorCalendarEvent(createdGoogleCalendarEvent: calendar_v3.Schema$Event): ConferenceLink {

        const googleMeetConferenceLink = createdGoogleCalendarEvent.conferenceData as calendar_v3.Schema$ConferenceData;
        const generatedGoogleMeetLink = (googleMeetConferenceLink.entryPoints as calendar_v3.Schema$EntryPoint[])[0].uri;
        const convertedConferenceLink: ConferenceLink = {
            type: IntegrationVendor.GOOGLE,
            serviceName: 'Google Meet',
            link: generatedGoogleMeetLink
        };

        return convertedConferenceLink;
    }

    getIntegrationVendor(): IntegrationVendor {
        return IntegrationVendor.GOOGLE;
    }
}
