import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from '@services/notifications/notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
    imports: [ConfigModule],
    controllers: [NotificationsController],
    providers: [NotificationsService],
    exports: [NotificationsService]
})
export class NotificationsModule {}
