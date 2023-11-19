import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from '@services/notifications/notifications.service';
import { EventsModule } from '@services/events/events.module';
import { SyncdayAwsSdkClientModule } from '@services/util/syncday-aws-sdk-client/syncday-aws-sdk-client.module';
import { NotificationsController } from './notifications.controller';

@Module({
    imports: [
        ConfigModule,
        EventsModule,
        SyncdayAwsSdkClientModule
    ],
    controllers: [NotificationsController],
    providers: [NotificationsService],
    exports: [NotificationsService]
})
export class NotificationsModule {}
