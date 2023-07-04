import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { SearchByUserOption } from '@app/interfaces/search-by-user-option.interface';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';

@Injectable()
export class GoogleIntegrationsService {
    constructor(
        @InjectRepository(GoogleIntegration)
        private readonly googleIntegrationRepository: Repository<GoogleIntegration>,
        @InjectDataSource() private datasource: DataSource
    ) {}

    async search({ userId }: SearchByUserOption): Promise<GoogleIntegration[]> {
        return await this.googleIntegrationRepository.findBy({
            users: {
                id: userId
            }
        });
    }

    /**
     * This method saves google integration including calendars.
     *
     * @param user
     * @param googleAuthToken
     * @param googleCalendarIntegrations
     * @returns
     */
    async createGoogleIntegration(
        user: User,
        googleAuthToken: OAuthToken,
        googleCalendarIntegrations: GoogleCalendarIntegration[]
    ): Promise<GoogleIntegration> {

        const newGoogleIngration: GoogleIntegration = {
            accessToken: googleAuthToken.accessToken,
            refreshToken: googleAuthToken.refreshToken,
            email: user.email,
            users: [user],
            googleCalendarIntegrations: googleCalendarIntegrations.map((calendar) => {
                calendar.users = [user];
                return calendar;
            })
        } as GoogleIntegration;

        const createdGoogleIntegration = await this.googleIntegrationRepository.save(newGoogleIngration);

        return createdGoogleIntegration;
    }

    async remove(googleIntegrationId: number, userId:number ): Promise<boolean> {
        const googleIntegration = await this.googleIntegrationRepository.find({
            where: {
                users: {
                    id: userId
                }
            },
            relations: {
                googleCalendarIntegrations: true
            }
        });

        const googleCalendarIntegrationIds  = googleIntegration.reduce((googleCalendarIntegrationIds, googleIntegrations) => {
            const calendarIds = googleIntegrations.googleCalendarIntegrations.map((_calIntegration) => _calIntegration.id);
            return googleCalendarIntegrationIds.concat(calendarIds);

        }, [] as number[]);

        const deleteSuccess = await this.datasource.transaction(async (transactionManager) => {
            const _googleIntegrationRepository = transactionManager.getRepository(GoogleIntegration);
            const _googleCalendarIntegrationRepository = transactionManager.getRepository(GoogleCalendarIntegration);

            const _deleteGoogleCalendarIntegrationUsersUserResult = await _googleCalendarIntegrationRepository
                .createQueryBuilder()
                .delete()
                .from('google_calendar_integration_users_user')
                .where('user_id = :userId', { userId })
                .execute();

            const _deleteGoogleCalendarIntegrationResult = await _googleCalendarIntegrationRepository.delete(googleCalendarIntegrationIds);

            const _deleteGoogleIntegrationUserResult = await _googleIntegrationRepository
                .createQueryBuilder()
                .delete()
                .from('google_integration_users')
                .where('google_integration_id = :googleIntegrationId', { googleIntegrationId })
                .execute();
            const _deleteGoogleIntegrationResult = await _googleIntegrationRepository.delete({ id:googleIntegrationId });

            const isDeleteResultList = [
                _deleteGoogleCalendarIntegrationUsersUserResult,
                _deleteGoogleCalendarIntegrationResult,
                _deleteGoogleIntegrationUserResult,
                _deleteGoogleIntegrationResult
            ];

            for (const deleteResult of isDeleteResultList) {
                const deleteSuccess = deleteResult.affected && deleteResult.affected >= 0;
                if (deleteSuccess === false) {
                    throw new InternalServerErrorException('Delete GoogleIntegration detail or GoogleIntegration is failed');
                }
            }

            return true;
        });

        return deleteSuccess;
    }
}
