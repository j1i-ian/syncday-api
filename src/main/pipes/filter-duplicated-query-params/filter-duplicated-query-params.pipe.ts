import { Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class FilterDuplicatedQueryParamsPipe implements PipeTransform {
    transform(value: string): string {

        if (value) {
            value = value.split('?')[0];
        }

        return value;
    }
}
