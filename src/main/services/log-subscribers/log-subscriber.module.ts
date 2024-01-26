import { Module } from '@nestjs/common';
import { LogSubscriberService } from './log-subscriber.service';

@Module({
    providers: [LogSubscriberService]
})
export class LogSubscriberModule {}
