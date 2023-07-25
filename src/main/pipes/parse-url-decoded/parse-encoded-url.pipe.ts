import { Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseEncodedUrl implements PipeTransform {
    transform(value?: undefined | null | string): undefined | null | string {

        if (value) {

            const limit = 10;
            let count = 0;
            let finalDecoded = value;

            do {
                finalDecoded = decodeURIComponent(value);

                if (finalDecoded === value || count > limit) {
                    break;
                } else {
                    count++;

                    value = finalDecoded;
                }

            } while (true);
            value = finalDecoded;
        }

        return value;
    }
}
