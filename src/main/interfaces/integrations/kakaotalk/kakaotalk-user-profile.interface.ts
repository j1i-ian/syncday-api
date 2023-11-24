export interface KakaotalkUserProfile {
    name: string;
    email: string;
    age_range: string;
    birthyear: string;
    birthday: string;
    birthday_type: string;
    gender: string;
    phone_number: string;
    ci: string;
    profile_needs_agreement: boolean;
    profile_nickname_needs_agreement: boolean;
    profile_image_needs_agreement: boolean;
    name_needs_agreement: boolean;
    email_needs_agreement: boolean;
    is_email_valid: boolean;
    is_email_verified: boolean;
    age_range_needs_agreement: boolean;
    birthyear_needs_agreement: boolean;
    birthday_needs_agreement: boolean;
    gender_needs_agreement: boolean;
    phone_number_needs_agreement: boolean;
    ci_needs_agreement: boolean;

    profile: {
        nickname: string;
        thumbnail_image_url: string;
        profile_image_url: string;
        is_default_image: boolean;
    };
}
