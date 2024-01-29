import { MeetingType } from './enum/meeting-type.enum';
import { Setting } from './interface/setting.interface';
import { Recurrence } from './interface/recurrence.interface';
import { TrackingField } from './interface/tracking-field.interface';

/**
 * [Docs]{@link https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetingCreate}
 */
export interface ZoomCreateMeetingResponseDTO {
    assistant_id: string;
    host_email: string;
    id: number;
    registration_url: string;
    agenda: string;
    created_at: Date;
    duration: number;
    h323_password: string;
    join_url: string;
    occurrences: Occurrence[];
    password: string;
    pmi: string;
    pre_schedule: boolean;
    recurrence: Recurrence;
    settings: Setting;
    start_time: Date;
    start_url: string;
    timezone: string;
    topic: string;
    tracking_fields: TrackingField[];
    type: MeetingType;
}

interface Occurrence {
    duration: number;
    occurrence_id: string;
    start_time: Date;
    status: string;
}
