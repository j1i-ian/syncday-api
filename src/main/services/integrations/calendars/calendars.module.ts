import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module, forwardRef } from '@nestjs/common';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { UserModule } from '../../users/user.module';
import { GoogleCalendarService } from './google-calendar.service';
import { CalendarsController } from './calendars.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([GoogleIntegration]),
        ConfigModule,
        forwardRef(() => UserModule)
    ],
    providers: [GoogleCalendarService],
    controllers: [CalendarsController],
    exports: [GoogleCalendarService]
})
export class CalendarsModule {}
