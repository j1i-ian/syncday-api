import { Module } from '@nestjs/common';
import { SyncdayRedisService } from './syncday-redis.service';

@Module({
    providers: [SyncdayRedisService],
    exports: [SyncdayRedisService]
})
export class SyncdayRedisModule {}
