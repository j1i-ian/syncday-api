import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoreUtilService } from '@services/utils/core-util.service';

@Injectable()
export class UtilService extends CoreUtilService {

    constructor(private readonly configService: ConfigService) {
        super();
    }

    getFullRedisKey(key: string): string {
        const fullname = `${this.configService.get<string>('ENV') as string}:${key}`;

        return fullname;
    }
}
