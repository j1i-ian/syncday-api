import { Routes } from '@nestjs/core';
import { EventGroupsModule } from '@services/event-groups/event-groups.module';
import { EventsModule } from '@services/event-groups/events/events.module';
import { SchedulesModule } from '@services/schedules/schedules.module';
import { UserSettingModule } from '@services/users/user-setting/user-setting.module';
import { UserModule } from '@services/users/user.module';
import { PaymentsModule } from '../main/services/payments/payments.module';

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
    }
];
