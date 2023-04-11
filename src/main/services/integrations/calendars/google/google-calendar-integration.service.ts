import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Auth, calendar_v3 } from 'googleapis';
import { UserService } from '@services/users/user.service';
import { IntegrationUtilService } from '@services/util/integration-util/integraion-util.service';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { IntegrationCalendarSetting } from '@entity/integrations/google/Integration-calendar-setting.entity';
import { CreateGoogleIntegrationDto } from '@dto/integrations/google/create-google-integration-request.dto';
import { GetIntegrationCalendarListResponseDto } from '@dto/integrations/google/calendars/get-integration-calendar-list-response.dto';
import { CreateGoogleCalendarIntegrationRequestDto } from '@dto/integrations/google/calendars/create-google-calendar-integration-request.dto';
import { UpdateGoogleCalendarIntegrationDto } from '@dto/integrations/google/calendars/update-google-calendar-integration-request.dto';
import { CalendarListSearchOption } from '../../../../parameters/integrations/get-calendar-list.param';
import { CalendarSearchOption } from '../../../../enums/integrations/calendar-search-option.enum';

@Injectable()
export class GoogleCalendarIntegrationService {
    constructor(
        private readonly userService: UserService,
        private readonly integrationUtilService: IntegrationUtilService,
        @InjectRepository(GoogleIntegration)
        private readonly googleIntegrationRepository: Repository<GoogleIntegration>,
        @InjectRepository(GoogleCalendarIntegration)
        private readonly googleCalendarIntegrationRepository: Repository<GoogleCalendarIntegration>
    ) {}

    /**
     * TODO: 유저 정책에 따른 캘린더 연동 제한
     * TODO: 디폴트 캘린더 구독 처리
     *
     */
    async createIntegration(
        userId: number,
        requestBody: CreateGoogleIntegrationDto
    ): Promise<GoogleIntegration> {
        const user = await this.userService.findUserById(userId);
        const oauthClient = this.integrationUtilService.getGoogleOauthClient(
            requestBody.redirectUri
        );

        const userInfo = await this.integrationUtilService.getGoogleUserInfo(
            requestBody.authorizationCode,
            requestBody.redirectUri
        );

        const primaryCalendar = await this.integrationUtilService.getGooglePrimaryCalendar(
            userInfo.refreshToken,
            oauthClient
        );

        const newIntegration = new GoogleIntegration();
        newIntegration.accessToken = userInfo.accessToken;
        newIntegration.refreshToken = userInfo.refreshToken;
        newIntegration.email = userInfo.email;
        newIntegration.users = [user];

        const savedGoogleIntegration = await this.googleIntegrationRepository.save(newIntegration);

        await this._saveDefaultCalendar(user, savedGoogleIntegration, primaryCalendar);

        return savedGoogleIntegration;
    }

    async getCalendarList(
        userId: number,
        integrationId: number,
        query: CalendarListSearchOption
    ): Promise<GetIntegrationCalendarListResponseDto> {
        const googleIntegration = await this._findGoogleIntegrationById(userId, integrationId);

        let calendarSetting: IntegrationCalendarSetting;

        if (query.accessRole === CalendarSearchOption.WRITE) {
            calendarSetting = {
                deleteSynchronize: true,
                readSynchronize: true,
                writeSynchronize: true
            };
        } else {
            calendarSetting = {
                deleteSynchronize: false,
                writeSynchronize: false,
                readSynchronize: true
            };
        }

        const result = await this.integrationUtilService.getGoogleCalendarList(
            calendarSetting,
            googleIntegration
        );

        return {
            email: googleIntegration.email,
            items: result.items?.map((item) => ({
                id: item.id,
                subject: item.summary
            }))
        };
    }

    /**
     * Parse number string for expiration.
     * Google calendar channel expiration of result includes milliseconds.
     * So you need not to update for changing to javascript date object.
     *
     * @param googleCalendarId
     * @param googleCalendarIntegrationId
     * @param googleIntegration
     */
    async subscribeModifingEvents(
        googleCalendarId: string,
        googleCalendarIntegrationId: number,
        googleIntegration: GoogleIntegration
    ): Promise<void> {
        const googleCalendarIntegration = await this._findGoogleCalendarIntegrationDetailById(
            googleCalendarIntegrationId
        );

        const subscribeResult =
            await this.integrationUtilService.subscribeGoogleCalendarModifingEvents(
                googleIntegration,
                googleCalendarId,
                googleCalendarIntegration.uuid
            );

        await this.googleCalendarIntegrationRepository.update(googleCalendarIntegrationId, {
            resourceId: subscribeResult.resourceId,
            channelExpiration: new Date(+subscribeResult.expiration)
        });
    }

    async unsubscribeModifingEvents(
        googleIntegration: GoogleIntegration,
        googleCalendarIntegrationId: number
    ): Promise<void> {
        const googleCalendarIntegration = await this._findGoogleCalendarIntegrationDetailById(
            googleCalendarIntegrationId
        );

        await this.integrationUtilService.unsubscribeGoogleCalendarModifingEvents(
            googleIntegration,
            googleCalendarIntegration.uuid,
            googleCalendarIntegration.resourceId
        );

        await this.googleCalendarIntegrationRepository.update(googleCalendarIntegrationId, {
            channelExpiration: null,
            resourceId: null
        });
    }

    async getGoogleCalendarConnections(
        userId: number,
        integrationId: number,
        searchQuery: CalendarListSearchOption
    ): Promise<GoogleCalendarIntegration[]> {
        let accessRoleWhereStatement: FindOptionsWhere<IntegrationCalendarSetting> = {
            readSynchronize: true
        };

        if (searchQuery.accessRole === CalendarSearchOption.WRITE) {
            accessRoleWhereStatement = {
                ...accessRoleWhereStatement,
                writeSynchronize: true
            };
        }

        const result = await this.googleCalendarIntegrationRepository.find({
            relations: {
                users: true,
                googleIntegration: true
            },
            where: {
                users: {
                    id: userId
                },
                googleIntegration: {
                    id: integrationId
                },
                settings: accessRoleWhereStatement
            }
        });

        return result;
    }

    /**
     * TODO: read, delete가 참일 경우 subscription 생성하기
     */
    async createGoogleCalendarConnection(
        userId: number,
        createGoogleCalendarIntegrationRequestDto: CreateGoogleCalendarIntegrationRequestDto
    ): Promise<GoogleCalendarIntegration> {
        const googleIntegration = await this._findGoogleIntegrationById(
            userId,
            createGoogleCalendarIntegrationRequestDto.googleIntegrationId
        );

        const { calendarId, settings, subject } = createGoogleCalendarIntegrationRequestDto;

        const newGoogleCalendarIntegration = this.googleCalendarIntegrationRepository.create({
            calendarId,
            settings,
            subject,
            users: googleIntegration.users,
            googleIntegration
        });

        return await this.googleCalendarIntegrationRepository.save(newGoogleCalendarIntegration);
    }

    /**
     * TODO: subscription 해지하기
     */
    async deleteGoogleCalendarConnection(
        userId: number,
        googleCalendarIntegrationId: number
    ): Promise<{ affected: boolean }> {
        const googleCalendarIntegration = await this.findGoogleCalendarIntegrationDetailById(
            userId,
            googleCalendarIntegrationId
        );

        const removeResult = await this.googleCalendarIntegrationRepository.remove(
            googleCalendarIntegration
        );

        return { affected: removeResult ? true : false };
    }

    /**
     * TODO: subscription 생성 또는 해지
     */
    async updateGoogleCalendarConnection(
        userId: number,
        googleCalendarIntegrationId: number,
        updateGoogleCalendarIntegrationDto: UpdateGoogleCalendarIntegrationDto
    ): Promise<{ affected?: boolean }> {
        const googleCalendarIntegration = await this.findGoogleCalendarIntegrationDetailById(
            userId,
            googleCalendarIntegrationId
        );

        const { affected } = await this.googleCalendarIntegrationRepository.update(
            googleCalendarIntegration.id,
            updateGoogleCalendarIntegrationDto
        );

        return { affected: affected && affected > 0 ? true : false };
    }

    async _saveDefaultCalendar(
        user: User,
        googleIntegration: GoogleIntegration,
        primaryCalendar: calendar_v3.Schema$Calendar
    ): Promise<void> {
        const defaultCalendar = this.googleCalendarIntegrationRepository.create({
            calendarId: primaryCalendar.id as string,
            subject: primaryCalendar.summary as string,
            googleIntegration,
            settings: {
                deleteSynchronize: true,
                readSynchronize: true,
                writeSynchronize: true
            },
            users: [user]
        });

        await this.googleCalendarIntegrationRepository.save(defaultCalendar);
    }

    async _getTokensByAuthorizationCode(
        authorizationCode: string,
        oauthClient: Auth.OAuth2Client
    ): Promise<{
        accessToken: string | null | undefined;
        refreshToken: string | null | undefined;
    }> {
        const { tokens } = await oauthClient.getToken(authorizationCode);
        return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
    }

    async _findGoogleIntegrationById(
        userId: number,
        integrationId: number
    ): Promise<GoogleIntegration> {
        return this.googleIntegrationRepository.findOneOrFail({
            relations: {
                users: true
            },
            where: {
                users: {
                    id: userId
                },
                id: integrationId
            }
        });
    }

    async _findGoogleCalendarIntegrationDetailById(
        googleCalendarIntegrationId: number
    ): Promise<GoogleCalendarIntegration> {
        return await this.googleCalendarIntegrationRepository.findOneOrFail({
            where: {
                id: googleCalendarIntegrationId
            }
        });
    }

    private async findGoogleCalendarIntegrationDetailById(
        userId: number,
        googleCalendarIntegrationId: number
    ): Promise<GoogleCalendarIntegration> {
        return this.googleCalendarIntegrationRepository.findOneOrFail({
            relations: {
                users: true,
                googleIntegration: true
            },
            where: {
                users: {
                    id: userId
                },
                id: googleCalendarIntegrationId
            }
        });
    }
}
