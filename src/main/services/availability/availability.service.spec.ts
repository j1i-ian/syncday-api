import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom, of } from 'rxjs';
import { InternalServerErrorException } from '@nestjs/common';
import { Availability } from '@core/entities/availability/availability.entity';
import { User } from '@core/entities/users/user.entity';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { CreateAvailabilityRequestDto } from '@dto/availability/create-availability-request.dto';
import { NoDefaultAvailabilityException } from '@app/exceptions/availability/no-default-availability.exception';
import { CannotDeleteDefaultAvailabilityException } from '@app/exceptions/availability/cannot-delete-default-availability.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { Validator } from '@criteria/validator';
import { AvailabilityService } from './availability.service';

const testMockUtil = new TestMockUtil();

describe('AvailabilityService', () => {
    let service: AvailabilityService;

    let module: TestingModule;
    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let validatorStub: sinon.SinonStubbedInstance<Validator>;

    let availabilityRepositoryStub: sinon.SinonStubbedInstance<Repository<Availability>>;
    let availabilityRedisRepositoryStub: sinon.SinonStubbedInstance<AvailabilityRedisRepository>;

    before(async () => {
        validatorStub = sinon.createStubInstance(Validator);
        availabilityRepositoryStub = sinon.createStubInstance<Repository<Availability>>(Repository);
        availabilityRedisRepositoryStub = sinon.createStubInstance<AvailabilityRedisRepository>(
            AvailabilityRedisRepository
        );

        module = await Test.createTestingModule({
            providers: [
                AvailabilityService,
                {
                    provide: Validator,
                    useValue: validatorStub
                },
                {
                    provide: AvailabilityRedisRepository,
                    useValue: availabilityRedisRepositoryStub
                },
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
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
            availabilityRepositoryStub.findOne.reset();
            availabilityRepositoryStub.findOneByOrFail.reset();
            availabilityRepositoryStub.update.reset();
            availabilityRepositoryStub.delete.reset();
            availabilityRepositoryStub.save.reset();
            availabilityRedisRepositoryStub.getAvailabilityBodyRecord.reset();
            availabilityRedisRepositoryStub.getAvailabilityBody.reset();
            availabilityRedisRepositoryStub.save.reset();
            availabilityRedisRepositoryStub.deleteAvailabilityBody.reset();
        });

        it('should be fetched availability list', async () => {
            const userStub = stubOne(User);
            const availabilities = stub(Availability);
            const availabilityBodyStubs =
                testMockUtil.getAvailabilityBodyRecordMocks(availabilities);

            availabilityRepositoryStub.find.resolves(availabilities);
            availabilityRedisRepositoryStub.getAvailabilityBodyRecord.resolves(
                availabilityBodyStubs
            );

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
            availabilityRedisRepositoryStub.getAvailabilityBody.resolves(availabilityBodyStub);

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
            availabilityRedisRepositoryStub.save.resolves(availabilityBodyStub);

            const loadedAvailability = await service.create(
                userStub.id,
                userStub.uuid,
                availabilityBodyStub as CreateAvailabilityRequestDto
            );

            expect(availabilityRepositoryStub.save.called).true;
            expect(availabilityRedisRepositoryStub.save.called).true;
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
            availabilityRedisRepositoryStub.save.resolves(updateAvailabilityRequestDtoMock);

            const loadedAvailability = await service.update(
                availabilityStub.id,
                userStub.uuid,
                updateAvailabilityStub
            );

            expect(availabilityRepositoryStub.findOneByOrFail.called).true;
            expect(availabilityRepositoryStub.update.called).true;
            expect(availabilityRedisRepositoryStub.save.called).true;
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
            availabilityRedisRepositoryStub.save.resolves(updateAvailabilityRequestDtoMock);

            await expect(
                service.update(availabilityStub.id, userStub.uuid, updateAvailabilityStub)
            ).rejectedWith(InternalServerErrorException);

            expect(availabilityRepositoryStub.findOneByOrFail.called).true;
            expect(availabilityRepositoryStub.update.called).true;
            expect(availabilityRedisRepositoryStub.save.called).false;
        });

        describe('Test availability patch', () => {
            afterEach(() => {
                availabilityRepositoryStub.update.reset();
                availabilityRepositoryStub.findOneByOrFail.reset();
                availabilityRedisRepositoryStub.getAvailabilityBodyRecord.reset();
                availabilityRedisRepositoryStub.getAvailabilityBody.reset();
                availabilityRedisRepositoryStub.save.reset();
            });

            it('should be patched default as true and previous default availability should be patched default as false ', async () => {
                const userStub = stubOne(User);
                const availabilityStub = stubOne(Availability, {
                    default: false
                });

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                const patchResult = await service.patch(
                    availabilityStub.id,
                    userStub.id,
                    userStub.uuid,
                    {
                        ...availabilityStub,
                        default: true
                    }
                );

                expect(patchResult).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.calledTwice).true;
                expect(availabilityRedisRepositoryStub.save.called).false;
            });

            it('should be patched default as true with name, timezone and previous default availability should be patched default as false ', async () => {
                const userStub = stubOne(User);
                const availabilityStub = stubOne(Availability, {
                    default: false
                });

                const newTimezone = 'newTimezone';

                expect(newTimezone).not.equals(availabilityStub.timezone);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                const patchResult = await service.patch(
                    availabilityStub.id,
                    userStub.id,
                    userStub.uuid,
                    {
                        ...availabilityStub,
                        default: true
                    }
                );

                expect(patchResult).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.calledTwice).true;
                expect(availabilityRedisRepositoryStub.save.called).false;
            });

            it('should be threw error when default request value is false if that target availability is default', async () => {
                const userStub = stubOne(User);
                const availabilityStub = stubOne(Availability, {
                    default: true
                });

                const newTimezone = 'newTimezone';

                expect(newTimezone).not.equals(availabilityStub.timezone);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                await expect(
                    service.patch(availabilityStub.id, userStub.id, userStub.uuid, {
                        ...availabilityStub,
                        default: false
                    })
                ).rejectedWith(NoDefaultAvailabilityException);

                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.called).false;
                expect(availabilityRepositoryStub.update.calledTwice).false;
                expect(availabilityRedisRepositoryStub.save.called).false;
            });

            it('should be patched name, timezone when patching default request value is false', async () => {
                const userStub = stubOne(User);
                const availabilityStub = stubOne(Availability, {
                    default: false
                });

                const newTimezone = 'newTimezone';

                expect(newTimezone).not.equals(availabilityStub.timezone);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                const patchResult = await service.patch(
                    availabilityStub.id,
                    userStub.id,
                    userStub.uuid,
                    availabilityStub
                );

                expect(patchResult).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.called).true;
                expect(availabilityRepositoryStub.update.calledTwice).false;
                expect(availabilityRedisRepositoryStub.save.called).false;
            });

            it('should be patched availableTimes with overrides', async () => {
                const userStub = stubOne(User);
                const availabilityStub = stubOne(Availability, {
                    default: false
                });
                const patchAvailabilityRequestDtoMock =
                    testMockUtil.getAvailabilityBodyMock(availabilityStub);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                const patchResult = await service.patch(
                    availabilityStub.id,
                    userStub.id,
                    userStub.uuid,
                    patchAvailabilityRequestDtoMock
                );

                expect(patchResult).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.called).false;
                expect(availabilityRepositoryStub.update.calledTwice).false;
                expect(availabilityRedisRepositoryStub.save.called).true;
            });

            it('should be not patched when dto has only availableTimes, not include overrides', async () => {
                const userStub = stubOne(User);
                const availabilityStub = stubOne(Availability, {
                    default: false
                });
                const patchAvailabilityRequestDtoMock =
                    testMockUtil.getAvailabilityBodyMock(availabilityStub);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                const patchResult = await service.patch(
                    availabilityStub.id,
                    userStub.id,
                    userStub.uuid,
                    patchAvailabilityRequestDtoMock
                );

                expect(patchResult).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.called).false;
                expect(availabilityRepositoryStub.update.calledTwice).false;
                expect(availabilityRedisRepositoryStub.save.called).true;
            });
        });

        describe('Test availability delete', () => {
            it('should be removed availability which is not default', async () => {
                const availabilityStub = stubOne(Availability, {
                    default: false
                });
                const userStub = stubOne(User);
                const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock();

                availabilityRepositoryStub.findOne.resolves(availabilityStub);
                availabilityRepositoryStub.delete.resolves(deleteResultStub);

                const result = await service.remove(
                    availabilityStub.id,
                    userStub.id,
                    userStub.uuid
                );

                expect(result).true;
                expect(availabilityRepositoryStub.findOne.called).true;
                expect(availabilityRepositoryStub.delete.called).true;
                expect(availabilityRedisRepositoryStub.deleteAvailabilityBody.called).true;
            });

            it('should be not removed availability which is default', async () => {
                const availabilityStub = stubOne(Availability, {
                    default: true
                });
                const userMock = stubOne(User);
                const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock();

                availabilityRepositoryStub.findOne.resolves(availabilityStub);
                availabilityRepositoryStub.delete.resolves(deleteResultStub);

                await expect(
                    service.remove(availabilityStub.id, userMock.id, userMock.uuid)
                ).rejectedWith(CannotDeleteDefaultAvailabilityException);

                expect(availabilityRepositoryStub.findOne.called).true;
                expect(availabilityRepositoryStub.delete.called).false;
                expect(availabilityRedisRepositoryStub.deleteAvailabilityBody.called).false;
            });
        });

        describe('Test availability clone', () => {
            afterEach(() => {
                validatorStub.validate.reset();
                availabilityRedisRepositoryStub.clone.reset();
                availabilityRepositoryStub.save.reset();
            });

            it('should be cloned without error', async () => {
                const availabilityStub = stubOne(Availability, {
                    default: false
                });
                const clonedAvailabilityStub = stubOne(Availability, {
                    default: false
                });
                const userMock = stubOne(User);

                const availabilityBody = testMockUtil.getAvailabilityBodyMock(availabilityStub);

                validatorStub.validate.resolves(availabilityStub);

                availabilityRepositoryStub.save.resolves(clonedAvailabilityStub);

                availabilityRedisRepositoryStub.clone.returns(of(availabilityBody));

                const clonedAvailability = await service.clone(
                    availabilityStub.id,
                    userMock.id,
                    userMock.uuid
                );

                expect(clonedAvailability).ok;
                expect(clonedAvailability.default).false;
                expect(validatorStub.validate.called).true;
                expect(availabilityRepositoryStub.save.called).true;
                expect(availabilityRepositoryStub.save.getCall(0).args[0].default).false;
                expect(availabilityRedisRepositoryStub.clone.called).true;
            });

            it('should be cloned from default availabilitly, the clone has default false property.', async () => {
                const availabilityStub = stubOne(Availability, {
                    default: true
                });
                const clonedAvailabilityStub = stubOne(Availability, {
                    default: false
                });
                const userMock = stubOne(User);

                const availabilityBody = testMockUtil.getAvailabilityBodyMock(availabilityStub);

                validatorStub.validate.resolves(availabilityStub);

                availabilityRepositoryStub.save.resolves(clonedAvailabilityStub);

                availabilityRedisRepositoryStub.clone.returns(of(availabilityBody));

                const clonedAvailability = await service.clone(
                    availabilityStub.id,
                    userMock.id,
                    userMock.uuid
                );

                expect(clonedAvailability).ok;
                expect(clonedAvailability.default).false;
                expect(validatorStub.validate.called).true;
                expect(availabilityRepositoryStub.save.called).true;
                expect(availabilityRepositoryStub.save.getCall(0).args[0].default).false;
                expect(availabilityRedisRepositoryStub.clone.called).true;
            });
        });
    });
});
