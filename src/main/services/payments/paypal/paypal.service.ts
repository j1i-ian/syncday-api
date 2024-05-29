import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'node-fetch';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { AppConfigService } from '@config/app-config.service';
import { PayPalTokenResponse } from '@services/payments/payment-method/paypal.interfaces';

@Injectable()
export class PaypalService {

    constructor(
        private readonly configService: ConfigService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {
        const {
            clientId,
            secret,
            hostUrl
        } = AppConfigService.getPaypalSetting(this.configService);

        this.clientId = clientId;
        this.clientSecret = secret;
        this.hostUrl = hostUrl;

        this.base64EncodedCredentials = Buffer.from(`${clientId}:${secret}`).toString('base64');

        (async () => {
            this.authToken = await this.getAuthToken();
        })();
    }

    clientId: string;
    clientSecret: string;
    hostUrl: string;

    authToken: string;
    base64EncodedCredentials: string;

    async validatePGSubscription(
        vendorSubscriptionUUID: string
    ): Promise<boolean> {

        const paypalHostUrl = this.hostUrl;
        const subscriptionUrl = [paypalHostUrl, 'v1/billing/subscriptions', vendorSubscriptionUUID].join('/');

        const response = await fetch(subscriptionUrl, {
            method: 'GET',
            headers: this.authHeader
        });
        const validated = response.ok;

        if (validated === false) {

            const errorTextMessage = await response.text();

            this.logger.info({
                errorTextMessage
            });

            throw new BadRequestException('Subscription is invalid');
        }

        return validated;
    }

    async getAuthToken(): Promise<string> {

        const basicAuthHeader = this.basicAuthHeader;

        const paypalHostUrl = this.hostUrl;
        const tokenUrl = [paypalHostUrl, 'v1/oauth2/token'].join('/');

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: basicAuthHeader,
            body: 'grant_type=client_credentials'
        });

        const tokenData: PayPalTokenResponse = await response.json();
        return tokenData.access_token;
    }

    get authHeader(): { [header: string]: string } {
        return {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
        };
    }

    get basicAuthHeader(): { [header: string]: string } {
        return {
            'Authorization': `Basic ${this.base64EncodedCredentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        };
    }
}
