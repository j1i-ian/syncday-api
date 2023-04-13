import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { RawAxiosRequestHeaders } from 'axios';
import { Repository } from 'typeorm';
import { ZoomMeeting } from '@entity/integrations/zoom/zoom-meeting.entity';
import { ZoomTokenResponseDTO } from '@app/interfaces/integrations/zoom/zoom-token-response.interface';
import { ZoomTokenRequestDTO } from '@app/interfaces/integrations/zoom/zoom-token-request.interface';
import { UserService } from '@app/services/users/user.service';
import { UtilService } from '@app/services/util/util.service';
import { AppConfigService } from '../../../../../configs/app-config.service';
import { ZoomIntegrationFailException } from '../../../../exceptions/zoom-integration-fail.exception';

@Injectable()
export class ZoomMeetingIntegrationService {
    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
        private readonly userService: UserService,
        private readonly utilService: UtilService,
        @InjectRepository(ZoomMeeting)
        private readonly zoomMeetingRepository: Repository<ZoomMeeting>
    ) {}

    async createIntegration(userId: number, authCode: string): Promise<ZoomMeeting> {
        const { access_token, refresh_token } = await this._getZoomAccessTokenWithAuthCode(
            authCode
        );

        const user = await this.userService.findUserById(userId);

        const newZoomMeeting = new ZoomMeeting();
        newZoomMeeting.accessToken = access_token;
        newZoomMeeting.refreshToken = refresh_token;
        newZoomMeeting.users = [user];

        const addedZoomMeeting = await this.zoomMeetingRepository.save(newZoomMeeting);

        return addedZoomMeeting;
    }

    async _getZoomAccessTokenWithAuthCode(authCode: string): Promise<ZoomTokenResponseDTO> {
        try {
            const basicAuthValue = AppConfigService.getZoomBasicAuthValue(this.configService);
            const basicAuth = this.utilService.getZoomBasicAuth(basicAuthValue);

            const headers: RawAxiosRequestHeaders = {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${basicAuth}`
            };

            const zoomIntegrationRedirectUrl = AppConfigService.getZoomIntegrationRedirectUrl(
                this.configService
            );

            const body: Omit<ZoomTokenRequestDTO, 'refresh_token'> = {
                code: authCode,
                grant_type: 'authorization_code',
                redirect_uri: zoomIntegrationRedirectUrl
            };

            const zoomTokenUrl = AppConfigService.getZoomTokenUrl(this.configService);
            const issuZoomTokenResponse = await firstValueFrom(
                this.httpService.post(zoomTokenUrl, body, { headers })
            );

            const zoomToken: ZoomTokenResponseDTO = issuZoomTokenResponse.data;

            return zoomToken;
        } catch (error) {
            throw new ZoomIntegrationFailException();
        }
    }

    async _getZoomAccessTokenWithRefreshToken(refreshToken: string): Promise<ZoomTokenResponseDTO> {
        try {
            const basicAuthValue = AppConfigService.getZoomBasicAuthValue(this.configService);
            const basicAuth = this.utilService.getZoomBasicAuth(basicAuthValue);

            const headers: RawAxiosRequestHeaders = {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${basicAuth}`
            };

            const body: Omit<ZoomTokenRequestDTO, 'code' | 'redirect_uri'> = {
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            };

            const zoomTokenUrl = AppConfigService.getZoomTokenUrl(this.configService);
            const issuZoomTokenResponse = await firstValueFrom(
                this.httpService.post(zoomTokenUrl, body, {
                    headers
                })
            );
            const zoomToken: ZoomTokenResponseDTO = issuZoomTokenResponse.data;

            return zoomToken;
        } catch (error) {
            throw new ZoomIntegrationFailException('Failed to retry to link with Zoom');
        }
    }
}
