import { Method } from '../enum/method.enum';

export interface ApprovedOrDeniedCountriesOrRegions {
    approved_list: string[];
    denied_list: string[];
    enable: boolean;
    method: Method;
}
