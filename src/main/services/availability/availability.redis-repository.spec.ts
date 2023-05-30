import { Test, TestingModule } from '@nestjs/testing';
import { Cluster } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import { Weekday } from '@interfaces/availability/weekday.enum';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { User } from '@entity/users/user.entity';
import { Availability } from '@entity/availability/availability.entity';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';
import { AvailabilityBodySaveFail } from '@app/exceptions/availability/availability-body-save-fail.exception';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';
import { TestMockUtil } from '@test/test-mock-util';

const testMockUtil = new TestMockUtil();

describe('Availability Redis Repository Test', () => {
    let service: AvailabilityRedisRepository;

    let clusterStub: sinon.SinonStubbedInstance<Cluster>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;

    beforeEach(async () => {
        clusterStub = sinon.createStubInstance(Cluster);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);

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
                AvailabilityRedisRepository
            ]
        }).compile();

        service = module.get<AvailabilityRedisRepository>(AvailabilityRedisRepository);
    });

    describe('Test Availability CRUD', () => {
        let serviceSandbox: sinon.SinonSandbox;

        before(() => {
            serviceSandbox = sinon.createSandbox();
        });

        after(() => {
            syncdayRedisServiceStub._getAvailabilityHashMapKey.reset();
            clusterStub.hset.reset();

            serviceSandbox.restore();
        });

        it('coverage fill: save', async () => {
            const uuidKey = '';
            const updatedHashFieldStub = 1;

            syncdayRedisServiceStub._getAvailabilityHashMapKey.returns(uuidKey);

            clusterStub.hset.resolves(updatedHashFieldStub);

            const verification = await service.save(uuidKey, uuidKey, {
                availableTimes: [],
                overrides: []
            } as AvailabilityBody);
            expect(verification).ok;
        });

        it('should be saved all for availability bodies with sorting', async () => {
            const userUUIDMock = stubOne(User).uuid;
            const availabilityUUIDStub = stubOne(Availability).uuid;
            const updateAvailabilityBodyStub = testMockUtil.getAvailabilityBodyMock();
            updateAvailabilityBodyStub.availableTimes = [
                { day: Weekday.MONDAY, timeRanges: [{ startTime: '09:00', endTime: '19:00' }] },
                { day: Weekday.SUNDAY, timeRanges: [{ startTime: '09:00', endTime: '19:00' }] }
            ];

            const timestamp = Date.now();
            updateAvailabilityBodyStub.overrides = [
                {
                    targetDate: new Date(timestamp + 1000 * 10),
                    timeRanges: [{ startTime: '09:00', endTime: '19:00' }]
                },
                {
                    targetDate: new Date(timestamp + 1000 * 5),
                    timeRanges: [{ startTime: '09:00', endTime: '19:00' }]
                }
            ];

            const availabilityBodyMocks = [
                {
                    uuid: availabilityUUIDStub,
                    availableTimes: updateAvailabilityBodyStub.availableTimes,
                    overrides: updateAvailabilityBodyStub.overrides
                }
            ];
            const availabilityRecordStub =
                testMockUtil.getAvailabilityBodyRecordMocks(availabilityBodyMocks);
            const createdItemCountStub = 0;

            const getAvailabilityBodyRecordStub = serviceSandbox
                .stub(service, 'getAvailabilityBodyRecord')
                .resolves(availabilityRecordStub);
            syncdayRedisServiceStub._getAvailabilityHashMapKey.returns(userUUIDMock);
            clusterStub.hset.resolves(createdItemCountStub);

            const result = await service.saveAll(userUUIDMock, updateAvailabilityBodyStub);

            expect(result).true;
            expect(getAvailabilityBodyRecordStub.called).true;
            expect(syncdayRedisServiceStub._getAvailabilityHashMapKey.called).true;
            expect(clusterStub.hset.called).true;

            const availabilityBodyMapStub = clusterStub.hset.getCall(0).args[1] as unknown as Map<
                string,
                string
            >;
            expect(availabilityBodyMapStub).ok;

            const parsedUpdateAvailabilityBodyJsonString = availabilityBodyMapStub.get(
                availabilityUUIDStub
            ) as string;
            const parsedUpdateAvailabilityBody: AvailabilityBody = JSON.parse(
                parsedUpdateAvailabilityBodyJsonString
            );

            expect(parsedUpdateAvailabilityBody).ok;
            expect(parsedUpdateAvailabilityBody.availableTimes[0].day).lessThan(
                parsedUpdateAvailabilityBody.availableTimes[1].day
            );
            expect(
                new Date(parsedUpdateAvailabilityBody.overrides[0].targetDate).getTime()
            ).greaterThan(new Date(parsedUpdateAvailabilityBody.overrides[1].targetDate).getTime());
        });

        it('should be threw error when one or more availability body is created on update', async () => {
            const userUUIDMock = stubOne(User).uuid;
            const availabilityUUIDStub = stubOne(Availability).uuid;
            const updateAvailabilityBodyStub = testMockUtil.getAvailabilityBodyMock();
            updateAvailabilityBodyStub.availableTimes = [
                { day: Weekday.MONDAY, timeRanges: [{ startTime: '09:00', endTime: '19:00' }] },
                { day: Weekday.SUNDAY, timeRanges: [{ startTime: '09:00', endTime: '19:00' }] }
            ];

            const timestamp = Date.now();
            updateAvailabilityBodyStub.overrides = [
                {
                    targetDate: new Date(timestamp + 1000 * 10),
                    timeRanges: [{ startTime: '09:00', endTime: '19:00' }]
                },
                {
                    targetDate: new Date(timestamp + 1000 * 5),
                    timeRanges: [{ startTime: '09:00', endTime: '19:00' }]
                }
            ];

            const availabilityBodyMocks = [
                {
                    uuid: availabilityUUIDStub,
                    availableTimes: updateAvailabilityBodyStub.availableTimes,
                    overrides: updateAvailabilityBodyStub.overrides
                }
            ];
            const availabilityRecordStub =
                testMockUtil.getAvailabilityBodyRecordMocks(availabilityBodyMocks);
            const createdItemCountStub = 5;

            const getAvailabilityBodyRecordStub = serviceSandbox
                .stub(service, 'getAvailabilityBodyRecord')
                .resolves(availabilityRecordStub);
            syncdayRedisServiceStub._getAvailabilityHashMapKey.returns(userUUIDMock);
            clusterStub.hset.resolves(createdItemCountStub);

            await expect(service.saveAll(userUUIDMock, updateAvailabilityBodyStub)).rejectedWith(
                AvailabilityBodySaveFail
            );

            expect(getAvailabilityBodyRecordStub.called).true;
            expect(syncdayRedisServiceStub._getAvailabilityHashMapKey.called).true;
            expect(clusterStub.hset.called).true;
        });

        it('should be got parsed availability body: getAvailability', async () => {
            const uuidKey = '';

            syncdayRedisServiceStub._getAvailabilityHashMapKey.returns(uuidKey);

            clusterStub.hget.resolves('{}');

            const verification = await service.getAvailabilityBody(uuidKey, uuidKey);
            expect(verification).ok;
        });

        it('should be removed availability body by hash field: deleteAvailability', async () => {
            const uuidKey = 'ABCDFF';
            const deleteCountStub = 1;

            syncdayRedisServiceStub._getAvailabilityHashMapKey.returns(uuidKey);

            clusterStub.hdel.resolves(deleteCountStub);

            const deleteSuccess = await service.deleteAvailabilityBody(uuidKey, uuidKey);
            expect(deleteSuccess).true;
        });

        it('should be got parsed availability bodies with getAvailabilityBodyRecord', async () => {
            const uuidKey = '';

            syncdayRedisServiceStub._getAvailabilityHashMapKey.returns(uuidKey);

            syncdayRedisServiceStub.__parseHashmapRecords.returns({});

            clusterStub.hget.resolves('{}');

            const loadedAvailabilityBodyRecord = await service.getAvailabilityBodyRecord(uuidKey);

            expect(syncdayRedisServiceStub.__parseHashmapRecords.called).true;
            expect(loadedAvailabilityBodyRecord).ok;
        });

        it('should be cloned availability body', async () => {
            const userUUIDMock = stubOne(User).uuid;
            const [{ uuid: sourceAvailabilityUUIDMock }, { uuid: newAvailabilityUUIDMock }] = stub(
                Availability,
                2
            );

            const bodyStub = {} as AvailabilityBody;

            const getAvailabilityBodyStub = serviceSandbox.stub(service, 'getAvailabilityBody');
            getAvailabilityBodyStub.resolves(bodyStub);
            const saveAvailabilityBodyStub = serviceSandbox.stub(service, 'save');
            saveAvailabilityBodyStub.resolves(bodyStub);

            const clonedAvailabilityBody = await firstValueFrom(
                service.clone(userUUIDMock, sourceAvailabilityUUIDMock, newAvailabilityUUIDMock)
            );

            expect(clonedAvailabilityBody).ok;
            expect(getAvailabilityBodyStub.called).true;
            expect(saveAvailabilityBodyStub.called).true;
        });
    });
});
