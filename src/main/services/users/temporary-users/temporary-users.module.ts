import { Module } from '@nestjs/common';
import { SyncdayRedisModule } from '../../syncday-redis/syncday-redis.module';
import { TemporaryUsersService } from './temporary-users.service';
import { TemporaryUsersController } from './temporary-users.controller';

@Module({
    imports: [SyncdayRedisModule],
    controllers: [TemporaryUsersController],
    providers: [TemporaryUsersService]
})
export class TemporaryUsersModule {}
