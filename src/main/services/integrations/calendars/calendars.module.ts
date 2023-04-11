import { Module } from '@nestjs/common';
import { GoogleModule } from '@services/integrations/calendars/google/google.module';

@Module({
    imports: [GoogleModule]
})
export class CalendarsModule {}
