import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '@entity/events/event.entity';
import { UserOwnCriteria } from '@criteria/user-own.criteria';

@Module({
    imports: [TypeOrmModule.forFeature([Event])],
    providers: [UserOwnCriteria],
    exports: [UserOwnCriteria]
})
export class SyncdayCriteriaModule {}
