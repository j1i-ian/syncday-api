import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '@config/app-config.service';

@Injectable()
export class PaypalService {

    constructor(
        private readonly configService: ConfigService
    ) {
        const {
            clientId,
            secret
        } = AppConfigService.getPaypalClientIdAndSecret(this.configService);

        this.clientId = clientId;
        this.clientSecret = secret;
    }

    clientId: string;
    clientSecret: string;

    getBasicAuthHeader(): string {
        return `${this.clientId}:${this.clientSecret}`;
    }
}
