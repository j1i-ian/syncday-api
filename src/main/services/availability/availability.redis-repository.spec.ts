import { Test, TestingModule } from '@nestjs/testing';
import { Cluster } from 'ioredis';
import { firstValueFrom } from 'rxjs';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { User } from '@entity/users/user.entity';
import { Availability } from '@entity/availability/availability.entity';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';

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
