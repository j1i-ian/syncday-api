import { Test, TestingModule } from '@nestjs/testing';
import { Cluster } from 'ioredis';
import { Logger } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { firstValueFrom } from 'rxjs';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { ScheduledEventsRedisRepository } from '@services/scheduled-events/scheduled-events.redis-repository';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';
import { CannotFindScheduleBody } from '@app/exceptions/scheduled-events/cannot-find-schedule-body.exception';
import { ScheduleBody } from '@app/interfaces/scheduled-events/schedule-body.interface';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';
import { TestMockUtil } from '@test/test-mock-util';

const testMockUtil = new TestMockUtil();

describe('Scheduled Events Redis Repository Test', () => {
    let service: ScheduledEventsRedisRepository;

    let clusterStub: sinon.SinonStubbedInstance<Cluster>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;

    let loggerStub: sinon.SinonStubbedInstance<Logger>;

    beforeEach(async () => {
        clusterStub = sinon.createStubInstance(Cluster);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);
        loggerStub = sinon.createStubInstance(Logger);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: getClusterToken(DEFAULT_CLUSTER_NAMESPACE),
                    useValue: clusterStub
                },
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
                },
                ScheduledEventsRedisRepository
            ]
        }).compile();

        service = module.get<ScheduledEventsRedisRepository>(ScheduledEventsRedisRepository);
    });

    describe('Test Scheduled Event on Redis Repository', () => {

        afterEach(() => {
            syncdayRedisServiceStub._getScheduleBodyKey.reset();
            clusterStub.get.reset();
            clusterStub.set.reset();
            clusterStub.hset.reset();
        });

        it('should be initialized service', () => {
            expect(service).ok;
        });

        it('should be fetched schedule body', async () => {

            const scheduledEventStub = stubOne(ScheduledEvent);
            const scheduleBodyStub = testMockUtil.getScheduleBodyMock();

            syncdayRedisServiceStub._getScheduleBodyKey.returns('SCHEDULE_BODY_KEY');
            clusterStub.get.resolves(JSON.stringify(scheduleBodyStub));

            const scheduleBody = await firstValueFrom(service.getScheduleBody(scheduledEventStub.uuid));

            expect(scheduleBody).deep.equals(scheduleBodyStub);
            expect(clusterStub.get.called).true;
        });

        it('should be thrown error when schedule body is null', async () => {

            const scheduledEventStub = stubOne(ScheduledEvent);
            const scheduleBodyStub = null;

            syncdayRedisServiceStub._getScheduleBodyKey.returns('SCHEDULE_BODY_KEY');
            clusterStub.get.resolves(scheduleBodyStub);

            await expect(
                firstValueFrom(
                    service.getScheduleBody(scheduledEventStub.uuid)
                )
            ).rejectedWith(CannotFindScheduleBody);

            expect(clusterStub.get.called).true;
        });

        it('should be returned true for schedule body creation', async () => {
            const uuidKey = '';
            const createdFieldResult = true;

            syncdayRedisServiceStub._getScheduleBodyKey.returns(uuidKey);

            clusterStub.set.resolves('OK');

            const setResult = await service.set(uuidKey, {
                inviteeAnswers: [],
                scheduledNotificationInfo: {}
            } as ScheduleBody);

            expect(setResult).ok;
            expect(setResult).equals(createdFieldResult);
            expect(clusterStub.set.called).true;
        });

        describe('Test scheduled event save', () => {
            let serviceSandbox: sinon.SinonSandbox;

            beforeEach(() => {
                serviceSandbox = sinon.createSandbox();
            });

            afterEach(() => {
                serviceSandbox.restore();
            });

            it('should be saved scheduled event', async () => {
                const setStub = serviceSandbox.stub(service, 'set');
                const scheduleUUIDMock = stubOne(ScheduledEvent).uuid;
                const scheduleBodyMock = testMockUtil.getScheduleBodyMock();

                setStub.resolves(true);

                const saveResult = await firstValueFrom(
                    service.save(
                        scheduleUUIDMock,
                        scheduleBodyMock
                    )
                );

                expect(saveResult).ok;
                expect(setStub.called).true;
            });
        });
    });

});