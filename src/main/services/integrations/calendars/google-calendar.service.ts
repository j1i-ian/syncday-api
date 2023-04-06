import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auth } from 'googleapis';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { CreateGoogleIntegrationDto } from '@dto/integrations/create-google-integration-request.dto';
import { UserService } from '../../users/user.service';
import { IntegrationUtilService } from '../../util/integration-util/integraion-util.service';

@Injectable()
export class GoogleCalendarService {
    constructor(
        private readonly userService: UserService,
        private readonly integrationUtilService: IntegrationUtilService,
        @InjectRepository(GoogleIntegration)
        private readonly googleIntegrationRepository: Repository<GoogleIntegration>
    ) {}

    /**
     * TODO: 유저 정책에 따른 캘린더 연동 제한
     * TODO: 디폴트 캘린더 조회 후 google_calenar_integration 테이블에 레코드 생성, 구독 처리
     *
     */
    async createIntegration(
        userId: number,
        requestBody: CreateGoogleIntegrationDto
    ): Promise<GoogleIntegration> {
        const user = await this.userService.findUserById(userId);

        const { accessToken, refreshToken } = await this.getTokensByAuthorizationCode(
            requestBody.authorizationCode,
            this.integrationUtilService.getGoogleOauthClient(requestBody.redirectUri)
        );

        const userInfo = await this.integrationUtilService.getGoogleUserInfo(
            refreshToken as string,
            this.integrationUtilService.getGoogleOauthClient()
        );

        const newIntegration = new GoogleIntegration();
        newIntegration.accessToken = accessToken as string;
        newIntegration.refreshToken = refreshToken as string;
        newIntegration.email = userInfo.email as string;
        newIntegration.users = [user];

        const result = await this.googleIntegrationRepository.save(newIntegration);

        return result;
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
}
