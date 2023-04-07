import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../../../@core/core/entities/users/user.entity';
import { SyncdayRedisModule } from '../../syncday-redis/syncday-redis.module';
import { TemporaryUsersService } from './temporary-users.service';
import { TemporaryUsersController } from './temporary-users.controller';

@Module({
    imports: [TypeOrmModule.forFeature([User]), SyncdayRedisModule],
    controllers: [TemporaryUsersController],
    providers: [TemporaryUsersService]
})
export class TemporaryUsersModule {}
