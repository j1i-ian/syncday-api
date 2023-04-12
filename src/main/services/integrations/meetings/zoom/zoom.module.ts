import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZoomMeeting } from '@entity/integrations/zoom/zoom-meeting.entity';
import { UserModule } from '@app/services/users/user.module';
import { UtilModule } from '@app/services/util/util.module';
import { ZoomMeetingController } from './zoom-meeting.controller';
import { ZoomMeetingIntegrationService } from './zoom-meeting-integration.service';

@Module({
    imports: [
        forwardRef(() => UserModule),
        UtilModule,
        ConfigModule,
        HttpModule,
        TypeOrmModule.forFeature([ZoomMeeting])
    ],
    providers: [ZoomMeetingIntegrationService],
    exports: [ZoomMeetingIntegrationService],
    controllers: [ZoomMeetingController]
})
export class ZoomModule {}
