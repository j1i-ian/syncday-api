import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from '@services/profiles/profiles.controller';
import { ProfilesRedisRepository } from '@services/profiles/profiles.redis-repository';
import { SyncdayRedisModule } from '@services/syncday-redis/syncday-redis.module';
import { Profile } from '@entity/profiles/profile.entity';
import { ProfilesService } from './profiles.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([ Profile ]),
        SyncdayRedisModule
    ],
    controllers: [ProfilesController],
    providers: [ProfilesService, ProfilesRedisRepository],
    exports: [ProfilesService]
})
export class ProfilesModule {}
