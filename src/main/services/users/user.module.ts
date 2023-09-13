import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityModule } from '@services/availability/availability.module';
import { EventsModule } from '@services/events/events.module';
import { IntegrationsModule } from '@services/integrations/integrations.module';
import { GoogleIntegrationModule } from '@services/integrations/google-integration/google-integration.module';
import { NotificationsModule } from '@services/notifications/notifications.module';
import { User } from '@entity/users/user.entity';
import { EventGroup } from '@entity/events/evnet-group.entity';
import { Event } from '@entity/events/event.entity';
import { EventDetail } from '@entity/events/event-detail.entity';
import { VerificationModule } from '../../auth/verification/verification.module';
import { TokenModule } from '../../auth/token/token.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserSettingModule } from './user-setting/user-setting.module';
import { TemporaryUsersModule } from './temporary-users/temporary-users.module';
import { SyncdayRedisModule } from '../syncday-redis/syncday-redis.module';
import { OAuth2AccountsModule } from './oauth2-accounts/oauth2-accounts.module';

/**
 * In the future, Redis repositories will be abstracted
 * in a similar way to feature modules in TypeORM
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([User,EventGroup, Event, EventDetail]),
        forwardRef(() => VerificationModule),
        forwardRef(() => TokenModule),
        // FIXME: remove this coupling after splitting sendMessage from integration module
        forwardRef(() => IntegrationsModule),
        UserSettingModule,
        SyncdayRedisModule,
        TemporaryUsersModule,
        AvailabilityModule,
        EventsModule,
        GoogleIntegrationModule,
        OAuth2AccountsModule,
        NotificationsModule
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
})
export class UserModule {}
