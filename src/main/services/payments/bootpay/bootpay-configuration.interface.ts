export interface BootpayConfiguration {
    application_id: string;
    private_key: string;
    mode?: 'development' | 'production' | 'stage';
}
