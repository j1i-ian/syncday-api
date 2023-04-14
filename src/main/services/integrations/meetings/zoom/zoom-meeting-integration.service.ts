import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { RawAxiosRequestHeaders } from 'axios';
import { Repository } from 'typeorm';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ZoomMeeting } from '@entity/integrations/zoom/zoom-meeting.entity';
import { ZoomTokenResponseDTO } from '@app/interfaces/integrations/zoom/zoom-token-response.interface';
import { ZoomTokenRequestDTO } from '@app/interfaces/integrations/zoom/zoom-token-request.interface';
import { UserService } from '@app/services/users/user.service';
import { UtilService } from '@app/services/util/util.service';
import { AppConfigService } from '../../../../../configs/app-config.service';
import { ZoomIntegrationFailException } from '../../../../exceptions/zoom-integration-fail.exception';
import { ZoomUserResponseDTO } from '../../../../interfaces/integrations/zoom/zoom-user-response.interface';

@Injectable()
export class ZoomMeetingIntegrationService {
    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
        private readonly userService: UserService,
        private readonly utilService: UtilService,
        @InjectRepository(ZoomMeeting)
        private readonly zoomMeetingRepository: Repository<ZoomMeeting>,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    async createIntegration(userId: number, authCode: string): Promise<ZoomMeeting> {
        const alreadyExistZoomIntegarion = await this.zoomMeetingRepository.findOne({
            where: {
                users: {
                    id: userId
                }
            },
            relations: {
                users: true
            }
        });

        if (alreadyExistZoomIntegarion) {
            throw new NotFoundException('Unable to link more than one zoom account');
        }

        const { access_token, refresh_token } = await this._getZoomAccessTokenWithAuthCode(
            authCode
        );
        const { email } = await this._getZoomUserInfo(access_token);

        const user = await this.userService.findUserById(userId);

        const newZoomMeeting = new ZoomMeeting();
        newZoomMeeting.email = email;
        newZoomMeeting.accessToken = access_token;
        newZoomMeeting.refreshToken = refresh_token;
        newZoomMeeting.users = [user];

        const addedZoomMeeting = await this.zoomMeetingRepository.save(newZoomMeeting);

        return addedZoomMeeting;
    }

    async disconnectIntegration(zoomMeetingId: number): Promise<void> {
        const zoomIntegration = await this.zoomMeetingRepository.findOneOrFail({
            where: {
                id: zoomMeetingId
            },
            relations: { users: true }
        });

        await this.zoomMeetingRepository.remove(zoomIntegration);
    }

    async fetchZoomMeeting(userId: number): Promise<ZoomMeeting> {
        const zoomIntegration = await this.zoomMeetingRepository.findOneOrFail({
            where: {
                users: {
                    id: userId
                }
            },
            relations: { users: true }
        });

        return zoomIntegration;
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
            this.logger.error(error);
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
            this.logger.error(error);
            throw new ZoomIntegrationFailException('Failed to retry to link with Zoom');
        }
    }

    async _getZoomUserInfo(accessToken: string): Promise<ZoomUserResponseDTO> {
        try {
            const headers: RawAxiosRequestHeaders = {
                Authorization: `Bearer ${accessToken}`
            };

            const zoomUserInfoUrl = AppConfigService.getZoomUserInfoUrl(this.configService);
            const zoomUserInfoResponse = await firstValueFrom(
                this.httpService.get(zoomUserInfoUrl, {
                    headers
                })
            );
            const zoomUerInfo: ZoomUserResponseDTO = zoomUserInfoResponse.data;

            return zoomUerInfo;
        } catch (error) {
            this.logger.error(error);
            throw new ZoomIntegrationFailException('Failed to retry to link with Zoom');
        }
    }
}
