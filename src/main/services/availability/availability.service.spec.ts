import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { InternalServerErrorException } from '@nestjs/common';
import { Availability } from '@core/entities/availability/availability.entity';
import { User } from '@core/entities/users/user.entity';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { CreateAvailabilityRequestDto } from '@dto/availability/create-availability-request.dto';
import { TestMockUtil } from '@test/test-mock-util';
import { AvailabilityService } from './availability.service';

const testMockUtil = new TestMockUtil();

describe('AvailabilityService', () => {
    let service: AvailabilityService;

    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;

    let availabilityRepositoryStub: sinon.SinonStubbedInstance<Repository<Availability>>;

    before(async () => {
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);

        availabilityRepositoryStub = sinon.createStubInstance<Repository<Availability>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AvailabilityService,
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                },
                {
                    provide: getRepositoryToken(Availability),
                    useValue: availabilityRepositoryStub
                }
            ]
        }).compile();

        service = module.get<AvailabilityService>(AvailabilityService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test Availability CRUD', () => {
        afterEach(() => {
            availabilityRepositoryStub.find.reset();
            availabilityRepositoryStub.update.reset();
            availabilityRepositoryStub.findOneByOrFail.reset();
            syncdayRedisServiceStub.getAvailabilityBodyRecord.reset();
            syncdayRedisServiceStub.getAvailability.reset();
            syncdayRedisServiceStub.setAvailability.reset();
        });

        it('should be fetched availability list', async () => {
            const userStub = stubOne(User);
            const availabilities = stub(Availability);
            const availabilityBodyStubs =
                testMockUtil.getAvailabilityBodyRecordMocks(availabilities);

            availabilityRepositoryStub.find.resolves(availabilities);
            syncdayRedisServiceStub.getAvailabilityBodyRecord.resolves(availabilityBodyStubs);

            const list = await firstValueFrom(
                service.search({
                    userId: userStub.id,
                    userUUID: userStub.uuid
                })
            );

            expect(list).ok;
            expect(list.length).greaterThan(0);
        });

        it('should be fetched availability detail', async () => {
            const userStub = stubOne(User);
            const availabilityStub = stubOne(Availability);
            const availabilityBodyStub = testMockUtil.getAvailabilityBodyMock(availabilityStub);

            availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);
            syncdayRedisServiceStub.getAvailability.resolves(availabilityBodyStub);

            const loadedAvailability = await firstValueFrom(
                service.fetchDetail(availabilityStub.id, userStub.id, userStub.uuid)
            );

            expect(loadedAvailability).ok;
        });

        it('should be created availability', async () => {
            const userStub = stubOne(User);
            const availabilityStub = stubOne(Availability);
            const availabilityBodyStub = testMockUtil.getAvailabilityBodyMock(availabilityStub);
            availabilityStub.availableTimes = availabilityBodyStub.availableTimes;
            availabilityStub.overrides = availabilityBodyStub.overrides;

            availabilityRepositoryStub.save.resolves(availabilityStub);
            syncdayRedisServiceStub.setAvailability.resolves(true);

            const loadedAvailability = await service.create(
                userStub.id,
                userStub.uuid,
                availabilityBodyStub as CreateAvailabilityRequestDto
            );

            expect(availabilityRepositoryStub.save.called).true;
            expect(syncdayRedisServiceStub.setAvailability.called).true;
            expect(loadedAvailability).ok;
        });

        it('should be updated availability when availability entity would be updated', async () => {
            const userStub = stubOne(User);
            const availabilityStub = stubOne(Availability);

            const updateAvailabilityName = 'updateupdate';
            const updateAvailabilityStub = stubOne(Availability, {
                name: updateAvailabilityName
            });

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

            const updateAvailabilityRequestDtoMock =
                testMockUtil.getAvailabilityBodyMock(availabilityStub);
            availabilityStub.availableTimes = updateAvailabilityRequestDtoMock.availableTimes;
            availabilityStub.overrides = updateAvailabilityRequestDtoMock.overrides;

            availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);
            availabilityRepositoryStub.update.resolves(updateResultStub);
            syncdayRedisServiceStub.setAvailability.resolves(true);

            const loadedAvailability = await service.update(
                availabilityStub.id,
                userStub.uuid,
                updateAvailabilityStub
            );

            expect(availabilityRepositoryStub.findOneByOrFail.called).true;
            expect(availabilityRepositoryStub.update.called).true;
            expect(syncdayRedisServiceStub.setAvailability.called).true;
            expect(loadedAvailability).ok;
        });

        it('should be not updated availability when availability entity would be not updated', async () => {
            const userStub = stubOne(User);
            const availabilityStub = stubOne(Availability);

            const updateAvailabilityName = 'updateupdate';
            const updateAvailabilityStub = stubOne(Availability, {
                name: updateAvailabilityName
            });

            const updateResultStub = TestMockUtil.getTypeormUpdateResultMock(0);

            const updateAvailabilityRequestDtoMock =
                testMockUtil.getAvailabilityBodyMock(availabilityStub);
            availabilityStub.availableTimes = updateAvailabilityRequestDtoMock.availableTimes;
            availabilityStub.overrides = updateAvailabilityRequestDtoMock.overrides;

            availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);
            availabilityRepositoryStub.update.resolves(updateResultStub);
            syncdayRedisServiceStub.setAvailability.resolves(true);

            await expect(
                service.update(availabilityStub.id, userStub.uuid, updateAvailabilityStub)
            ).rejectedWith(InternalServerErrorException);

            expect(availabilityRepositoryStub.findOneByOrFail.called).true;
            expect(availabilityRepositoryStub.update.called).true;
            expect(syncdayRedisServiceStub.setAvailability.called).false;
        });
    });
});
