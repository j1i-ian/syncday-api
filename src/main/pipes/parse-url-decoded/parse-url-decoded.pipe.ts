import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParseUrlDecodedPipe implements PipeTransform {
    transform(value?: undefined | null | string): string {

        if (value) {

            const limit = 10;
            let count = 0;
            let finalDecoded = value;

            do {
                finalDecoded = decodeURIComponent(value);
                count++;
            } while (finalDecoded !== value && count < limit);

            value = finalDecoded;
        } else {
            throw new BadRequestException('Invalid Query Param value');
        }

        return value;
    }
}
