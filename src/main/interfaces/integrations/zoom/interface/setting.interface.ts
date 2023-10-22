import { ApprovalType } from '../enum/approval-type.enum';
import { Audio } from '../enum/audio.enum';
import { AutoRecording } from '../enum/auto-recording.enum';
import { CalendarType } from '../enum/calendar-type.enum';
import { EncryptionType } from '../enum/encryption-type.enum';
import { JoinBeforeHost } from '../enum/join-before-host.enum';
import { RegistrationType } from '../enum/regrstration-type.enum';
import { ApprovedOrDeniedCountriesOrRegions } from './approved-denied-countries-regions.interface';
import { AuthenticationException } from './authentication-exception.interface';
import { BreakoutRoom } from './breakout-room.interface';
import { CustomKey } from './custom-key.interface';
import { GlobalDialInNumbers } from './global-dial-numbers.interface';
import { LanguageInterpretation } from './language-interpretation.interface';

export interface Setting {
    allow_multiple_devices: boolean;
    /**
     * @author Collin
     * When making an actual API request, the request is sent except for the property.
     * not working
     */
    alternative_hosts: string;
    alternative_hosts_email_notification: boolean;
    alternative_host_update_polls: boolean;
    approval_type: ApprovalType;
    approved_or_denied_countries_or_regions: ApprovedOrDeniedCountriesOrRegions;
    audio: Audio;
    audio_conference_info: string;
    authentication_domains: string;
    authentication_exception: AuthenticationException;
    authentication_name: string;
    /**
     * @author Collin
     * When making an actual API request, the request is sent except for the property.
     * not working
     */
    authentication_option: string;
    auto_recording: AutoRecording;
    breakout_room: BreakoutRoom;
    calendar_type: CalendarType;
    close_registration: boolean;
    contact_email: string;
    contact_name: string;
    customKeys: CustomKey[];
    email_notification: boolean;
    encryption_type: EncryptionType;
    focus_mode: boolean;
    cn_meeting: boolean;
    in_meeting: boolean;
    enforce_login: boolean;
    enforce_login_domains: string;
    request_permission_to_unmute_participants: boolean;
    internal_meeting: boolean;
    continuous_meeting_chat: {
        enable: boolean;
        auto_add_invited_external_users: boolean;
    };
    participant_focused_meeting: boolean;
    show_join_info: boolean;
    device_testing: boolean;
    enable_dedicated_group_chat: boolean;
    sign_language_interpretation: {
        enable: boolean;
    };
    email_in_attendee_report: boolean;

    /**
     * Country code provided by zoom
     * [docs] {@link https://marketplace.zoom.us/docs/api-reference/other-references/abbreviation-lists/#countries}
     */
    global_dial_in_countries: string[];
    /**
     * @author Collin
     * When making an actual API request, the request is sent except for the property.
     * not working
     */
    global_dial_in_numbers: GlobalDialInNumbers[];
    host_video: boolean;
    jbh_time: JoinBeforeHost;
    join_before_host: boolean;
    language_interpretation: LanguageInterpretation;
    meeting_authentication: boolean;
    mute_upon_entry: boolean;
    participant_video: boolean;
    private_meeting: boolean;
    registrants_confirmation_email: boolean;
    registrants_email_notification: boolean;
    registration_type: RegistrationType;
    show_share_button: boolean;
    use_pmi: boolean;
    waiting_room: boolean;
    watermark: boolean;
    host_save_video_order: boolean;
}
