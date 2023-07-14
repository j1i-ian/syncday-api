import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ValidateQueryParamPipe implements PipeTransform {
    transform(value?: undefined | null | string): string {

        if (!value || value === '' || value === 'undefined') {
            throw new BadRequestException('Invalid Query Param value');
        }

        return value;
    }
}
