import { Routes } from '@nestjs/core';
import { UserSettingModule } from '@services/users/user-setting/user-setting.module';
import { UserModule } from '@services/users/user.module';
import { AvailabilityModule } from '@services/availability/availability.module';
import { CalendarIntegrationsModule } from '@services/integrations/calendar-integrations/calendar-integrations.module';
import { EventsModule } from '@services/events/events.module';
import { EventDetailsModule } from '@services/events/event-details/event-details.module';
import { TokenModule } from '../main/auth/token/token.module';
import { VerificationModule } from '../main/auth/verification/verification.module';
import { IntegrationsModule } from '../main/services/integrations/integrations.module';
import { TemporaryUsersModule } from '../main/services/users/temporary-users/temporary-users.module';
import { WorkspacesModule } from '../main/services/workspaces/workspaces.module';
import { MeetingModule } from '../main/services/integrations/meetings/meetings.module';
import { ZoomModule } from '../main/services/integrations/meetings/zoom/zoom.module';

export const routes: Routes = [
    {
        path: 'users',
        module: UserModule,
        children: [
            {
                path: 'temporaries',
                module: TemporaryUsersModule
            }
        ]
    },
    {
        path: 'user-settings',
        module: UserSettingModule
    },
    {
        path: 'workspaces',
        module: WorkspacesModule
    },
    {
        path: 'tokens',
        module: TokenModule
    },
    {
        path: 'verifications',
        module: VerificationModule
    },
    {
        path: 'availabilities',
        module: AvailabilityModule
    },
    {
        path: 'events',
        module: EventsModule
    },
    {
        path: 'events-details',
        module: EventDetailsModule
    },
    {
        path: 'integrations',
        module: IntegrationsModule,
        children: [
            {
                path: 'calendars',
                module: CalendarIntegrationsModule
            },
            {
                path: 'meetings',
                module: MeetingModule,
                children: [
                    {
                        path: 'zoom',
                        module: ZoomModule
                    }
                ]
            }
        ]
    }
];
