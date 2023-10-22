import { URL } from 'url';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Raw, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { OAuthToken } from '@core/interfaces/auth/oauth-token.interface';
import { ConferenceLinkIntegrationService } from '@core/interfaces/integrations/conference-link-integration.abstract-service';
import { AppConfigService } from '@config/app-config.service';
import { SearchByUserOption } from '@interfaces/search-by-user-option.interface';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { IntegrationsFactory } from '@services/integrations/integrations.factory.interface';
import { ConferenceLinkIntegrationWrapperService } from '@services/integrations/conference-link-integration-wrapper-service.interface';
import { ZoomConferenceLinkIntegrationsService } from '@services/integrations/zoom-integrations/zoom-conference-link-integrations/zoom-conference-link-integrations.service';
import { ZoomIntegration } from '@entity/integrations/zoom/zoom-integration.entity';
import { Integration } from '@entity/integrations/integration.entity';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { EventStatus } from '@entity/events/event-status.enum';
import { IntegrationResponseDto } from '@dto/integrations/integration-response.dto';
import { ZoomUserResponseDTO } from '@app/interfaces/integrations/zoom/zoom-user-response.interface';
import { SearchZoomIntegrationOptions } from '@app/interfaces/integrations/zoom/search-zoom-integration-options.interface';

@Injectable()
export class ZoomIntegrationsService implements
    IntegrationsFactory,
    ConferenceLinkIntegrationWrapperService
{
    constructor(
        private readonly configService: ConfigService,
        private readonly zoomConferenceLinkIntegrationService: ZoomConferenceLinkIntegrationsService,
        @InjectDataSource() private readonly datasource: DataSource,
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

    async search(userSearchOption: SearchByUserOption): Promise<Integration[]> {

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
                IntegrationResponseDto,
                _integration,
                {
                    strategy: 'excludeAll'
                }
            )
        ) as Integration[];
    }

    findOne(searchZoomIntegrationOptions: SearchZoomIntegrationOptions): Promise<ZoomIntegration | null> {

        const { userId } = searchZoomIntegrationOptions;

        return this.zoomIntegrationRepository.findOne({
            relations: ['users'],
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
            integrationUserUniqueId: zoomOAuth2UserProfile.integrationUserUniqueId,
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

    async remove(zoomIntegrationId: number, userId: number): Promise<boolean> {

        // load events that linked with zoom integration
        // then update events to off
        await this.datasource.transaction(async (transactionManager) => {

            const eventRepository = transactionManager.getRepository(Event);
            const zoomIntegrationRepository = transactionManager.getRepository(ZoomIntegration);

            const zoomIntegration = await zoomIntegrationRepository.findOneOrFail({
                where: {
                    id: zoomIntegrationId,
                    users: {
                        id: userId
                    }
                }
            });

            const disableEventTargets = await eventRepository.find({
                where: {
                    eventGroup: {
                        user: {
                            id: userId,
                            zoomIntegrations: {
                                id: zoomIntegrationId
                            }
                        }
                    },
                    contacts: Raw((alias) => `JSON_CONTAINS(${alias}, '"${ContactType.ZOOM}"', '$[0].type')`)
                }
            });

            const disableEventTargetIds = disableEventTargets.map((_event) => _event.id);

            let isEventsUpdateSuccess = true;

            if (disableEventTargetIds.length > 0) {
                const eventUpdateResult = await eventRepository.update(disableEventTargetIds, {
                    contacts: [],
                    status: EventStatus.CLOSED
                });

                isEventsUpdateSuccess = (eventUpdateResult &&
                    eventUpdateResult.affected &&
                    eventUpdateResult.affected > 0) || false;
            }


            const zoomDeleteResult = await zoomIntegrationRepository.delete(zoomIntegration.id);

            const isZoomDeleteSuccess = zoomDeleteResult &&
                zoomDeleteResult.affected &&
                zoomDeleteResult.affected > 0;

            return isEventsUpdateSuccess && isZoomDeleteSuccess;
        });


        return true;
    }

    getConferenceLinkIntegrationService(): ConferenceLinkIntegrationService {
        return this.zoomConferenceLinkIntegrationService;
    }
}
