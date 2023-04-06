import { Routes } from '@nestjs/core';
import { EventGroupsModule } from '@services/event-groups/event-groups.module';
import { EventsModule } from '@services/event-groups/events/events.module';
import { SchedulesModule } from '@services/schedules/schedules.module';
import { UserSettingModule } from '@services/users/user-setting/user-setting.module';
import { UserModule } from '@services/users/user.module';
import { TokenModule } from '../main/auth/token/token.module';
import { PaymentsModule } from '../main/services/payments/payments.module';
import { VerificationModule } from '../main/auth/verification/verification.module';
import { IntegrationsModule } from '../main/services/integrations/integrations.module';
import { CalendarsModule } from '../main/services/integrations/calendars/calendars.module';

export const routes: Routes = [
    {
        path: 'users',
        module: UserModule,
        children: [
            {
                path: 'user-settings',
                module: UserSettingModule
            }
        ]
    },
    {
        path: 'tokens',
        module: TokenModule
    },
    {
        path: 'event-groups',
        module: EventGroupsModule,
        children: [
            {
                path: 'events',
                module: EventsModule
            }
        ]
    },
    {
        path: 'schedules',
        module: SchedulesModule
    },
    {
        path: 'payments',
        module: PaymentsModule
    },
    {
        path: 'verifications',
        module: VerificationModule
    },
    {
        path: 'integrations',
        module: IntegrationsModule,
        children: [
            {
                path: 'calendars',
                module: CalendarsModule
            }
        ]
    }
];
