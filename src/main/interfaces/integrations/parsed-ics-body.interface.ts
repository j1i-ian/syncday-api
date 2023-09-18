export interface ParsedICSBody {

    uid: string;
    summary: string;
    type: 'VEVENT';
    params: [];
    created: string | Date;
    start: string | Date;
    end: string | Date;
    lastmodified: string | Date;
    dtstamp: string[];
    datetype: 'date' | 'date-time';
    sequence: string;

    // patched by converter
    tz: string;
}
