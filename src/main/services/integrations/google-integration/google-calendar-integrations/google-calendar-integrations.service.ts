import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Observable, from } from 'rxjs';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { SearchByUserOption } from '@app/interfaces/search-by-user-option.interface';

@Injectable()
export class GoogleCalendarIntegrationsService {
    constructor(
        @InjectRepository(GoogleCalendarIntegration)
        private readonly googleCalendarIntegrationRepository: Repository<GoogleCalendarIntegration>
    ) {}

    search({ userId }: SearchByUserOption): Observable<GoogleCalendarIntegration[]> {
        return from(
            this.googleCalendarIntegrationRepository.find({
                where: {
                    users: {
                        id: userId
                    }
                }
            })
        );
    }

    async patch(
        userId: number,
        googleCalendarIntegrations:
        Array<Partial<GoogleCalendarIntegration> & Pick<GoogleCalendarIntegration, 'id' | 'setting'>>
    ): Promise<boolean> {

        // validate if there is more than one outboundWriteSync
        const outboundWriteSyncCounts = googleCalendarIntegrations.filter((googleCalendarSettingStatus) =>
            googleCalendarSettingStatus.setting.outboundWriteSync === true
        );

        if (outboundWriteSyncCounts.length > 1) {
            throw new BadRequestException('Only one calendar can be linked');
        }

        const googleCalendarIntegrationIds = googleCalendarIntegrations.map(
            (_calendarIntegration) => _calendarIntegration.id
        );

        // check owner permission
        const loadedCalendars = await this.googleCalendarIntegrationRepository.find({
            select: {
                id: true
            },
            where: {
                id: In(googleCalendarIntegrationIds),
                users: {
                    id: userId
                }
            }
        });
        const loadedCalendarIds = loadedCalendars.map((_loadedCalendar) => _loadedCalendar.id);

        const noPermissionCalendar = googleCalendarIntegrationIds.find(
            (_calendarId) => loadedCalendarIds.includes(_calendarId) === false
        );
        const isLengthStrange = loadedCalendars.length !== googleCalendarIntegrations.length;

        if (noPermissionCalendar && isLengthStrange) {
            throw new NotAnOwnerException();
        }

        const saved = await this.googleCalendarIntegrationRepository.save(
            googleCalendarIntegrations,
            {
                transaction: true
            }
        );

        return saved.length === googleCalendarIntegrations.length;
    }
}
