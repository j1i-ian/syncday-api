import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { ZoomMeeting } from '@entity/integrations/zoom/zoom-meeting.entity';
import { ZoomTokenResponseDTO } from '@app/interfaces/integrations/zoom/zoom-token-response.interface';
import { ZoomTokenRequestDTO } from '@app/interfaces/integrations/zoom/zoom-token-request.interface';
import { UserService } from '@app/services/users/user.service';
import { UtilService } from '@app/services/util/util.service';

@Injectable()
export class ZoomMeetingIntegrationService {
    constructor(
        @InjectDataSource() private datasource: DataSource,
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
        private readonly userService: UserService,
        private readonly utilService: UtilService
    ) {
        this._basicAuth = this.utilService.getBasicAuth(
            this.configService.get<string>('ZOOM_CLIENT_ID') as string,
            this.configService.get<string>('ZOOM_CLIENT_SECRET') as string
        );
    }
    private _basicAuth: string;

    async createIntegration(userId: number, authCode: string): Promise<ZoomMeeting> {
        const { access_token, refresh_token } = await this._getZoomAccessTokenWithAuthCode(
            authCode
        );

        const user = await this.userService.findUserById(userId);

        const newZoomMeeting = new ZoomMeeting();
        newZoomMeeting.accessToken = access_token;
        newZoomMeeting.refreshToken = refresh_token;
        newZoomMeeting.users = [user];

        const addedZoomMeeting = await this.datasource.transaction(
            async (manager: EntityManager) => {
                const _zoomMeetingRepository = manager.getRepository(ZoomMeeting);
                const _addedZoomMeeting = await _zoomMeetingRepository.save(newZoomMeeting);

                return _addedZoomMeeting;
            }
        );
        return addedZoomMeeting;
    }

    async _getZoomAccessTokenWithAuthCode(authCode: string): Promise<ZoomTokenResponseDTO> {
        try {
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${this._basicAuth}`
            };

            const body: Omit<ZoomTokenRequestDTO, 'refresh_token'> = {
                code: authCode,
                grant_type: 'authorization_code',
                redirect_uri: this.configService.get<string>(
                    'ZOOM_INTEGRATION_REDIRECT_URL'
                ) as string
            };

            const issuZoomTokenResponse = await firstValueFrom(
                this.httpService.post(
                    this.configService.get<string>('ZOOM_GET_TOKEN_URL') as string,
                    body,
                    { headers }
                )
            );

            const zoomToken: ZoomTokenResponseDTO = issuZoomTokenResponse.data;

            return zoomToken;
        } catch (error) {
            throw new BadRequestException('Failed to link with Zoom');
        }
    }

    async _getZoomAccessTokenWithRefreshToken(refreshToken: string): Promise<ZoomTokenResponseDTO> {
        try {
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${this._basicAuth}`
            };

            const body: Omit<ZoomTokenRequestDTO, 'code' | 'redirect_uri'> = {
                refresh_token: refreshToken,
                grant_type: 'refresh_token'
            };

            const issuZoomTokenResponse = await firstValueFrom(
                this.httpService.post(
                    this.configService.get<string>('ZOOM_GET_TOKEN_URL') as string,
                    body,
                    { headers }
                )
            );
            const zoomToken: ZoomTokenResponseDTO = issuZoomTokenResponse.data;

            return zoomToken;
        } catch (error) {
            throw new BadRequestException('Failed to retry to link with Zoom');
        }
    }
}
