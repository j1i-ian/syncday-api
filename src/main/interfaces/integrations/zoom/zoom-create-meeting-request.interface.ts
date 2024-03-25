import { MeetingType } from './enum/meeting-type.enum';
import { Setting } from './interface/setting.interface';
import { Recurrence } from './interface/recurrence.interface';
import { TrackingField } from './interface/tracking-field.interface';

/**
 * [Docs]{@link https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetingCreate}
 */
export interface ZoomCreateConferenceLinkRequestDTO {
    agenda: string;
    default_password: boolean;
    duration: number | '2';
    password: string;
    pre_schedule: boolean;
    recurrence: Recurrence;
    schedule_for: string;
    settings: RequestSetting;

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
