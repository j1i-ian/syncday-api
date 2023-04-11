import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '@services/users/user.module';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { GoogleCalendarsController } from './integration-calendars.controller';
import { GoogleCalendarIntegrationService } from './google-calendar-integration.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([GoogleIntegration, GoogleCalendarIntegration]),
        forwardRef(() => UserModule)
    ],
    controllers: [GoogleCalendarsController],
    providers: [GoogleCalendarIntegrationService]
})
export class GoogleModule {}
