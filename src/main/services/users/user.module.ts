import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityModule } from '@services/availability/availability.module';
import { EventsModule } from '@services/events/events.module';
import { IntegrationsModule } from '@services/integrations/integrations.module';
import { GoogleIntegrationModule } from '@services/integrations/google-integration/google-integration.module';
import { NotificationsModule } from '@services/notifications/notifications.module';
import { TeamModule } from '@services/team/team.module';
import { TeamSettingModule } from '@services/team/team-setting/team-setting.module';
import { ProfilesModule } from '@services/profiles/profiles.module';
import { OAuth2Module } from '@services/oauth2/oauth2.module';
import { User } from '@entity/users/user.entity';
import { EventGroup } from '@entity/events/event-group.entity';
import { VerificationModule } from '../../auth/verification/verification.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { SyncdayRedisModule } from '../syncday-redis/syncday-redis.module';
import { OAuth2AccountsModule } from './oauth2-accounts/oauth2-accounts.module';

/**
 * In the future, Redis repositories will be abstracted
 * in a similar way to feature modules in TypeORM
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([User, EventGroup]),
        OAuth2Module,
        SyncdayRedisModule,
        OAuth2AccountsModule,
        TeamSettingModule,
        AvailabilityModule,
        NotificationsModule,
        GoogleIntegrationModule,
        forwardRef(() => ProfilesModule),
        forwardRef(() => VerificationModule),
        // FIXME: remove this coupling after splitting sendMessage from integration module
        forwardRef(() => TeamModule),
        forwardRef(() => IntegrationsModule),
        EventsModule
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
})
export class UserModule {}
