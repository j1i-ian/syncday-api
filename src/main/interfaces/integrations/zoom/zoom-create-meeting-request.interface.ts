import { MeetingType } from './enum/meeting-type.enum';
import { Setting } from './interface/setting.interface';
import { Recurrence } from './interface/recurrence.interface';
import { TrackingField } from './interface/tracking-field.interface';

/**
 * [Docs]{@link https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetingCreate}
 */
export interface ZoomCreateMeetingRequestDTO {
    agenda: string;
    default_password: boolean;
    duration: '2';
    /**
     * a password can only have a maximum length of 10 characters and
     * only contain alphanumeric characters and the @, -, _, and * characters.
     */
    password: string;
    /**
     * @author Collin
     * When making an actual API request, the request is sent except for the property.
     * not working
     */
    pre_schedule: boolean;
    recurrence: Recurrence;
    /**
     * @author Collin
     * When making an actual API request, the request is sent except for the property.
     * not working
     */
    schedule_for: string;
    settings: RequestSetting;
    /**
     * dateTime UTC/GMT
     */
    start_time: Date;
    template_id: string;
    timezone: string;
    topic: string;
    tracking_fields: TrackingField[];
    type: MeetingType;
}

interface RequestSetting extends Setting {
    /**
     * Country code provided by zoom
     * [docs] {@link https://marketplace.zoom.us/docs/api-reference/other-references/abbreviation-lists/#countries}
     */
    additional_data_center_regions: string[];
    meeting_invitees: Array<{ email: string }>;
}
