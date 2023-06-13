import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityModule } from '@services/availability/availability.module';
import { EventsModule } from '@services/events/events.module';
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

@Module({
    imports: [
        TypeOrmModule.forFeature([User,EventGroup, Event, EventDetail]),
        VerificationModule,
        forwardRef(() => TokenModule),
        UserSettingModule,
        SyncdayRedisModule,
        TemporaryUsersModule,
        AvailabilityModule,
        EventsModule
    ],
    controllers: [UserController],
    providers: [UserService],
    exports: [UserService]
})
export class UserModule {}
