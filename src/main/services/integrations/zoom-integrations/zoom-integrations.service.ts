import { URL } from 'url';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { AppConfigService } from '@config/app-config.service';
import { IntegrationsServiceInterface } from '@services/integrations/integrations.service.interface';
import { ZoomIntegration } from '@entity/integrations/zoom/zoom-integration.entity';
import { Integration } from '@entity/integrations/integration.entity';
import { User } from '@entity/users/user.entity';
import { FetchZoomMeetingIntegrationResponse } from '@dto/integrations/zoom/fetch-zoom-meeting-integration-response.dto';
import { ZoomUserResponseDTO } from '@app/interfaces/integrations/zoom/zoom-user-response.interface';
import { SearchByUserOption } from '@app/interfaces/search-by-user-option.interface';

@Injectable()
export class ZoomIntegrationsService implements IntegrationsServiceInterface {
    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(ZoomIntegration)
        private readonly zoomIntegrationRepository: Repository<ZoomIntegration>
    ) {
        this.oauthClientId = this.configService.getOrThrow<string>('ZOOM_CLIENT_ID');
        this.redirectURI = AppConfigService.getZoomRedirectUri(this.configService);
        this.zoomOAuth2SuccessRedirectURI = this.configService.getOrThrow<string>('ZOOM_OAUTH2_SUCCESS_REDIRECT_URI');
    }

    oauthClientId: string;
    redirectURI: string;
    zoomOAuth2SuccessRedirectURI: string;

    async search(userSearchOption: SearchByUserOption): Promise<FetchZoomMeetingIntegrationResponse[]> {

        const { userId } = userSearchOption;

        const loadedZoomInterations = await this.zoomIntegrationRepository.find({
            where: {
                users: {
                    id: userId
                }
            }
        });

        return loadedZoomInterations.map(
            (_integration) => plainToInstance(
                FetchZoomMeetingIntegrationResponse,
                _integration,
                {
                    strategy: 'excludeAll'
                }
            )
        );
    }

    findOne(userSearchOption: SearchByUserOption): Promise<ZoomIntegration | null> {

        const { userId } = userSearchOption;

        return this.zoomIntegrationRepository.findOne({
            where: {
                users: {
                    id: userId
                }
            }
        });
    }

    async create(
        appUser: User,
        oauth2Token: OAuthToken,
        zoomOAuth2UserProfile: ZoomUserResponseDTO
    ): Promise<Integration> {

        const zoomEmail = zoomOAuth2UserProfile.email;

        const alreadyExistZoomIntegarion = appUser.zoomIntegrations.find((_zoomIntegration) => _zoomIntegration.email === zoomEmail);

        if (alreadyExistZoomIntegarion) {
            throw new BadRequestException('Target Zoom Integration is already integrated.');
        }

        const newIntegration: ZoomIntegration = {
            email: zoomEmail,
            accessToken: oauth2Token.accessToken,
            refreshToken: oauth2Token.refreshToken,
            users: [{ id: appUser.id }]
        } as ZoomIntegration;

        return await this.zoomIntegrationRepository.save(newIntegration);
    }

    generateOAuth2RedirectURI(syncdayAccessToken: string): string {

        const zoomOAuthRedirectURI = new URL('https://zoom.us/oauth/authorize');

        zoomOAuthRedirectURI.searchParams.append('response_type', 'code');
        zoomOAuthRedirectURI.searchParams.append('client_id', this.oauthClientId);
        zoomOAuthRedirectURI.searchParams.append('redirect_uri', this.redirectURI);
        zoomOAuthRedirectURI.searchParams.append('state', JSON.stringify({
            accessToken: syncdayAccessToken
        }));

        return zoomOAuthRedirectURI.toString();
    }

    async fetchDetail(userId: number): Promise<ZoomIntegration> {
        const zoomIntegration = await this.zoomIntegrationRepository.findOneOrFail({
            where: {
                users: {
                    id: userId
                }
            }
        });

        return zoomIntegration;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async remove(zoomIntegrationId: number, userId: number): Promise<boolean> {
        const zoomIntegration = await this.zoomIntegrationRepository.findOneOrFail({
            where: {
                id: zoomIntegrationId
            }
        });

        await this.zoomIntegrationRepository.remove(zoomIntegration);

        return true;
    }
}
