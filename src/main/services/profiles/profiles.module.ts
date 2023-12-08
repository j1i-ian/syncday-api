import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from '@services/profiles/profiles.controller';
import { Profile } from '@entity/profiles/profile.entity';
import { ProfilesService } from './profiles.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([ Profile ])
    ],
    controllers: [ProfilesController],
    providers: [ProfilesService],
    exports: [ProfilesService]
})
export class ProfilesModule {}
