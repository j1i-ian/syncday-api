import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilService {
    generateRandomNumberString(digit: number, prefix = '0'): string {
        return String(Math.floor(Math.random() * Math.pow(10, digit))).padStart(digit, prefix);
    }
}
