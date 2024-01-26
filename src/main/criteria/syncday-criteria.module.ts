import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '@entities/events/event.entity';
import { TeamOwnCriteria } from '@criteria/team-own.criteria';
import { Validator } from '@criteria/validator';

@Module({
    imports: [TypeOrmModule.forFeature([Event])],
    providers: [TeamOwnCriteria, Validator],
    exports: [TeamOwnCriteria, Validator]
})
export class SyncdayCriteriaModule {}
