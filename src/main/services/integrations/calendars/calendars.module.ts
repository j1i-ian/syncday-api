import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module, forwardRef } from '@nestjs/common';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { UserModule } from '../../users/user.module';
import { GoogleCalendarIntegrationService } from './google-calendar-integration.service';
import { IntegrationCalendarsController } from './integration-calendars.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([GoogleIntegration, GoogleCalendarIntegration]),
        ConfigModule,
        forwardRef(() => UserModule)
    ],
    providers: [GoogleCalendarIntegrationService],
    controllers: [IntegrationCalendarsController],
    exports: [GoogleCalendarIntegrationService]
})
export class CalendarsModule {}
