import { Module } from '@nestjs/common';
import { WorkspacesController } from './workspaces.controller';
import { SyncdayRedisModule } from '../syncday-redis/syncday-redis.module';

@Module({
    imports: [SyncdayRedisModule],
    controllers: [WorkspacesController]
})
export class WorkspacesModule {}
