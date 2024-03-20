/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { NestFactory } from '@nestjs/core';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '@app/../app.module';
import { EventsRedisRepository } from '@services/events/events.redis-repository';
import { UtilService } from '@services/util/util.service';
import { EventGroup } from '@entity/events/event-group.entity';

(async () => {

    const app = await NestFactory.create(AppModule);

    await app.init();

    const utilService = app.get(UtilService);

    const eventsRepository = app.get<Repository<EventGroup>>(getRepositoryToken(EventGroup));
    const eventsRedisRepository = app.get<EventsRedisRepository>(EventsRedisRepository);

})();
