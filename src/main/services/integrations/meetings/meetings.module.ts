import { Module } from '@nestjs/common';
import { ZoomModule } from './zoom/zoom.module';

@Module({
    imports: [ZoomModule]
})
export class MeetingModule {}
