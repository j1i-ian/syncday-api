import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '@entity/events/event.entity';
import { UserOwnCriteria } from '@criteria/user-own.criteria';
import { Validator } from '@criteria/validator';

@Module({
    imports: [TypeOrmModule.forFeature([Event])],
    providers: [UserOwnCriteria, Validator],
    exports: [UserOwnCriteria, Validator]
})
export class SyncdayCriteriaModule {}
