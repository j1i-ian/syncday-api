import { OAuth2UserProfile } from '@core/interfaces/integrations/oauth2-user-profile.interface';

export interface ZoomUserResponseDTO extends OAuth2UserProfile {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    type: number;
    role_name: string;
    pmi: number;
    use_pmi: boolean;
    personal_meeting_url: string;
    timezone: string;
    verified: number;
    dept: string;
    created_at: string;
    last_login_time: string;
    pic_url: string;
    cms_user_id: string;
    jid: string;
    group_ids: string[];
    im_group_ids: string[];
    account_id: string;
    language: string;
    phone_country: string;
    phone_number: string;
    status: string;
    job_title: string;
    location: string;
    login_types: number[];
    role_id: string;
    cluster: string;
    user_created_at: string;
}
