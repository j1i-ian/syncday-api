import { Routes } from '@nestjs/core';
import { UserSettingModule } from '@services/users/user-setting/user-setting.module';
import { UserModule } from '@services/users/user.module';
import { AvailabilityModule } from '@services/availability/availability.module';
import { CalendarIntegrationsModule } from '@services/integrations/calendar-integrations/calendar-integrations.module';
import { EventsModule } from '@services/events/events.module';
import { EventDetailsModule } from '@services/events/event-details/event-details.module';
import { BookingsModule } from '@services/bookings/bookings.module';
import { GoogleCalendarIntegrationsModule } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.module';
import { UtilModule } from '@services/util/util.module';
import { ZoomIntegrationsModule } from '@services/integrations/zoom-integrations/zoom-integrations.module';
import { NotificationsModule } from '@services/notifications/notifications.module';
import { OAuth2AccountsModule } from '@services/users/oauth2-accounts/oauth2-accounts.module';
import { TeamModule } from '@services/team/team.module';
import { TeamSettingModule } from '@services/team/team-setting/team-setting.module';
import { ProfilesModule } from '@services/profiles/profiles.module';
import { PaymentMethodModule } from '@services/payments/payment-method/payment-method.module';
import { OrdersModule } from '@services/orders/orders.module';
import { ScheduledEventsModule } from '@services/scheduled-events/scheduled-events.module';
import { TokenModule } from '../main/auth/token/token.module';
import { VerificationModule } from '../main/auth/verification/verification.module';
import { IntegrationsModule } from '../main/services/integrations/integrations.module';
import { TemporaryUsersModule } from '../main/services/users/temporary-users/temporary-users.module';

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
        path: 'profiles',
        module: ProfilesModule
    },
    {
        path: 'teams',
        module: TeamModule
    },
    {
        path: 'team-settings',
        module: TeamSettingModule
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
        path: 'bookings',
        module: BookingsModule
    },
    {
        path: 'integrations',
        module: IntegrationsModule,
        children: [
            {
                path: 'calendars',
                module: CalendarIntegrationsModule,
                children: [
                    {
                        path: 'notifications/google',
                        module: GoogleCalendarIntegrationsModule
                    }
                ]
            },
            {
                path: 'zoom',
                module: ZoomIntegrationsModule
            }
        ]
    },
    {
        path: 'utils',
        module: UtilModule
    },
    {
        path: 'notifications',
        module: NotificationsModule
    },
    {
        path: 'oauth2-accounts',
        module: OAuth2AccountsModule
    },
    {
        path: 'payment-methods',
        module: PaymentMethodModule
    },
    {
        path: 'orders',
        module: OrdersModule
    },
    {
        path: 'scheduled-events',
        module: ScheduledEventsModule
    }
];
