import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { IntegrationsRedisRepository } from '@services/integrations/integrations-redis.repository';
import { GoogleConverterService } from '@services/integrations/google-integration/google-converter/google-converter.service';
import { GoogleIntegrationSchedulesService } from '@services/integrations/google-integration/google-integration-schedules/google-integration-schedules.service';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { SearchByUserOption } from '@app/interfaces/search-by-user-option.interface';
import { OAuthToken } from '@app/interfaces/auth/oauth-token.interface';
import { GoogleIntegrationBody } from '@app/interfaces/integrations/google/google-integration-body.interface';

@Injectable()
export class GoogleIntegrationsService {
    constructor(
        private readonly googleConverterService: GoogleConverterService,
        private readonly googleCalendarIntegrationsService: GoogleCalendarIntegrationsService,
        private readonly googleIntegrationSchedulesService: GoogleIntegrationSchedulesService,
        private readonly integrationsRedisRepository: IntegrationsRedisRepository,
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
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
    async createGoogleIntegration(
        user: User,
        googleAuthToken: OAuthToken,
        googleCalendarIntegrations: GoogleCalendarIntegration[],
        googleIntegrationBody: GoogleIntegrationBody
    ): Promise<GoogleIntegration> {
        return this._createGoogleIntegration(
            this.googleIntegrationRepository.manager,
            user,
            googleAuthToken,
            googleCalendarIntegrations,
            googleIntegrationBody
        );
    }
    /* eslint-enable @typescript-eslint/no-explicit-any */

    async _createGoogleIntegration(
        manager: EntityManager,
        user: User,
        googleAuthToken: OAuthToken,
        googleCalendarIntegrations: GoogleCalendarIntegration[],
        googleIntegrationBody: GoogleIntegrationBody
    ): Promise<GoogleIntegration> {

        const newGoogleIngration: GoogleIntegration = {
            accessToken: googleAuthToken.accessToken,
            refreshToken: googleAuthToken.refreshToken,
            email: user.email,
            users: [user],
            googleCalendarIntegrations: googleCalendarIntegrations.map((calendar) => {

                /**
                 * TODO: It should be extracted as ORM Subscriber.
                 */
                if (calendar.primary) {
                    calendar.setting = {
                        conflictCheck: true,
                        outboundWriteSync: false,
                        inboundDecliningSync: false
                    };
                }

                calendar.users = [user];
                return calendar;
            })
        } as GoogleIntegration;

        const _googleIntegrationRepository = manager.getRepository(GoogleIntegration);
        const createdGoogleIntegration = await _googleIntegrationRepository.save(newGoogleIngration);

        const { schedules } = googleIntegrationBody;

        let hasSchedules = false;
        for (const prop in schedules) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            if (Object.hasOwn(schedules, prop)) {
                hasSchedules = true;
            }
        }

        // Google Channel Id is same to google calendar integration uuid.
        const primaryCalendarIntegration = createdGoogleIntegration.googleCalendarIntegrations.find((_calendar) => _calendar.primary) as GoogleCalendarIntegration;

        if (hasSchedules) {

            await this.integrationsRedisRepository.setGoogleCalendarSubscriptionStatus(
                primaryCalendarIntegration.uuid
            );

            const googleIntegrationSchedules = this.googleConverterService.convertToGoogleIntegrationSchedules(schedules);

            const _createdGoogleCalendarIntegrations = createdGoogleIntegration.googleCalendarIntegrations;

            const patchedGoogleIntegrationSchedules = googleIntegrationSchedules.map((_googleIntegrationSchedule) => {
                const _googleCalendarIntegration = _createdGoogleCalendarIntegrations.find(
                    (__createdGoogleCalendarIntegration) =>
                        __createdGoogleCalendarIntegration.name === _googleIntegrationSchedule.originatedCalendarId
                );

                _googleIntegrationSchedule.googleCalendarIntegrationId = _googleCalendarIntegration?.id as number;

                return _googleIntegrationSchedule;
            });

            await this.googleIntegrationSchedulesService._saveAll(
                manager,
                patchedGoogleIntegrationSchedules
            );
        }

        await this.googleCalendarIntegrationsService.subscribeCalendar(
            newGoogleIngration,
            primaryCalendarIntegration,
            {
                userRefreshToken: googleAuthToken.refreshToken
            }
        );

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
