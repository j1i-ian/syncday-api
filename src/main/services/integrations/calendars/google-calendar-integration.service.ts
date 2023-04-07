import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auth } from 'googleapis';
import { UserService } from '@services/users/user.service';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { IntegrationCalendarSetting } from '@entity/integrations/google/Integration-calendar-setting.entity';
import { CreateGoogleIntegrationDto } from '@dto/integrations/create-google-integration-request.dto';
import { GetIntegrationCalendarListResponseDto } from '@dto/integrations/get-integration-calendar-list-response.dto';
import { IntegrationUtilService } from '../../util/integration-util/integraion-util.service';
import { GetCalendarListSearchOption } from '../../../parameters/integrations/get-calendar-list.param';
import { CalendarSearchOption } from '../../../enums/integrations/calendar-search-option.enum';

@Injectable()
export class GoogleCalendarIntegrationService {
    constructor(
        private readonly userService: UserService,
        private readonly integrationUtilService: IntegrationUtilService,
        @InjectRepository(GoogleIntegration)
        private readonly googleIntegrationRepository: Repository<GoogleIntegration>,
        @InjectRepository(GoogleCalendarIntegration)
        private readonly googleCalnedarIntegrationRepository: Repository<GoogleCalendarIntegration>
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

        const { accessToken, refreshToken } = await this.getTokensByAuthorizationCode(
            requestBody.authorizationCode,
            oauthClient
        );

        const userInfo = await this.integrationUtilService.getGoogleUserInfo(
            refreshToken as string,
            oauthClient
        );

        const newIntegration = new GoogleIntegration();
        newIntegration.accessToken = accessToken as string;
        newIntegration.refreshToken = refreshToken as string;
        newIntegration.email = userInfo.email as string;
        newIntegration.users = [user];

        const result = await this.googleIntegrationRepository.save(newIntegration);

        await this.saveDefaultCalendar(user, result, oauthClient);

        return result;
    }

    async getCalendarList(
        userId: number,
        integrationId: number,
        query: GetCalendarListSearchOption
    ): Promise<GetIntegrationCalendarListResponseDto> {
        const googleIntegration = await this.findGoogleIntegrationById(userId, integrationId);

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

    private async saveDefaultCalendar(
        user: User,
        googleIntegration: GoogleIntegration,
        oauthClient: Auth.OAuth2Client
    ): Promise<void> {
        const primaryCalendar = await this.integrationUtilService.getGooglePrimaryCalendar(
            googleIntegration.refreshToken,
            oauthClient
        );

        const defaultCalendar = this.googleCalnedarIntegrationRepository.create({
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

        await this.googleCalnedarIntegrationRepository.save(defaultCalendar);
    }

    private async getTokensByAuthorizationCode(
        authorizationCode: string,
        oauthClient: Auth.OAuth2Client
    ): Promise<{
        accessToken: string | null | undefined;
        refreshToken: string | null | undefined;
    }> {
        const { tokens } = await oauthClient.getToken(authorizationCode);
        return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
    }

    private async findGoogleIntegrationById(
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
}
