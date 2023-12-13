import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom, of } from 'rxjs';
import { InternalServerErrorException } from '@nestjs/common';
import { Availability } from '@core/entities/availability/availability.entity';
import { User } from '@core/entities/users/user.entity';
import { Role } from '@interfaces/profiles/role.enum';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { EventsService } from '@services/events/events.service';
import { Event } from '@entity/events/event.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { Team } from '@entity/teams/team.entity';
import { CreateAvailabilityRequestDto } from '@dto/availability/create-availability-request.dto';
import { NoDefaultAvailabilityException } from '@app/exceptions/availability/no-default-availability.exception';
import { CannotDeleteDefaultAvailabilityException } from '@app/exceptions/availability/cannot-delete-default-availability.exception';
import { CannotUnlinkDefaultAvailabilityException } from '@app/exceptions/availability/cannot-unlink-default-availability.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { Validator } from '@criteria/validator';
import { AvailabilityService } from './availability.service';

const testMockUtil = new TestMockUtil();

describe('AvailabilityService', () => {
    let service: AvailabilityService;

    let module: TestingModule;
    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;
    let validatorStub: sinon.SinonStubbedInstance<Validator>;

    let availabilityRepositoryStub: sinon.SinonStubbedInstance<Repository<Availability>>;
    let availabilityRedisRepositoryStub: sinon.SinonStubbedInstance<AvailabilityRedisRepository>;

    before(async () => {
        eventsServiceStub = sinon.createStubInstance(EventsService);
        validatorStub = sinon.createStubInstance(Validator);
        availabilityRepositoryStub = sinon.createStubInstance<Repository<Availability>>(Repository);
        availabilityRedisRepositoryStub = sinon.createStubInstance<AvailabilityRedisRepository>(
            AvailabilityRedisRepository
        );

        module = await Test.createTestingModule({
            providers: [
                AvailabilityService,
                {
                    provide: EventsService,
                    useValue: eventsServiceStub
                },
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
            availabilityRepositoryStub.findOneOrFail.reset();
            availabilityRepositoryStub.findOneByOrFail.reset();
            availabilityRepositoryStub.update.reset();
            availabilityRepositoryStub.delete.reset();
            availabilityRepositoryStub.save.reset();
            availabilityRedisRepositoryStub.getAvailabilityBodyRecord.reset();
            availabilityRedisRepositoryStub.getAvailabilityBody.reset();
            availabilityRedisRepositoryStub.save.reset();
            availabilityRedisRepositoryStub.set.reset();
            availabilityRedisRepositoryStub.deleteAvailabilityBody.reset();
        });

        it('should be fetched availability list for owner, manager', async () => {
            const profileStub = stubOne(Profile);
            const availabilities = stub(Availability, 10, {
                profileId: profileStub.id
            });
            const availabilityBodyStubs =
                testMockUtil.getAvailabilityBodyRecordMocks(profileStub.id, availabilities);

            const roles = [Role.OWNER];

            availabilityRepositoryStub.find.resolves(availabilities);
            availabilityRedisRepositoryStub.getAvailabilityBodyRecord.resolves(
                availabilityBodyStubs
            );

            const list = await firstValueFrom(
                service.search({
                    profileId: profileStub.id,
                    profileUUID: profileStub.uuid
                }, roles)
            );

            expect(list).ok;
            expect(list.length).greaterThan(0);
            expect(availabilityRepositoryStub.find.called).true;
            expect(availabilityRedisRepositoryStub.getAvailabilityBodyRecord.called).true;
        });

        it('should be fetched availability list', async () => {
            const profileStub = stubOne(Profile);
            const availabilities = stub(Availability, 10, {
                profileId: profileStub.id
            });
            const availabilityBodyStubs =
                testMockUtil.getAvailabilityBodyRecordMocks(profileStub.id, availabilities);

            availabilityRepositoryStub.find.resolves(availabilities);
            availabilityRedisRepositoryStub.getAvailabilityBodyRecord.resolves(
                availabilityBodyStubs
            );
            const roles = [Role.MEMBER];

            const list = await firstValueFrom(
                service.search({
                    profileId: profileStub.id,
                    profileUUID: profileStub.uuid
                }, roles)
            );

            expect(list).ok;
            expect(list.length).greaterThan(0);
            expect(availabilityRepositoryStub.find.called).true;
            expect(availabilityRedisRepositoryStub.getAvailabilityBodyRecord.called).true;
        });

        it('should be fetched availability detail', async () => {
            const profileStub = stubOne(Profile);
            const teamStub = stubOne(Team);
            const availabilityStub = stubOne(Availability);
            const availabilityBodyStub = testMockUtil.getAvailabilityBodyMock(availabilityStub);

            availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);
            availabilityRedisRepositoryStub.getAvailabilityBody.resolves(availabilityBodyStub);

            const loadedAvailability = await firstValueFrom(
                service.fetchDetail(teamStub.uuid, profileStub.id, availabilityStub.id)
            );

            expect(loadedAvailability).ok;
        });

        it('should be fetched availability detail by user workspace and event link', async () => {
            const teamStub = stubOne(Team);
            const profileStub = stubOne(Profile, {
                team: teamStub
            });
            const eventStub = stubOne(Event);
            const availabilityStub = stubOne(Availability, {
                profile: profileStub
            });
            const availabilityBodyStub = testMockUtil.getAvailabilityBodyMock(availabilityStub);

            availabilityRepositoryStub.findOneOrFail.resolves(availabilityStub);
            availabilityRedisRepositoryStub.getAvailabilityBody.resolves(availabilityBodyStub);

            const loadedAvailability = await firstValueFrom(
                service.fetchDetailByTeamWorkspaceAndLink(
                    teamStub.workspace as string,
                    eventStub.link
                )
            );

            expect(loadedAvailability).ok;
        });

        it('should be created availability', async () => {
            const teamStub = stubOne(Team);
            const profileStub = stubOne(Profile);
            const availabilityStub = stubOne(Availability);
            const availabilityBodyStub = testMockUtil.getAvailabilityBodyMock(availabilityStub);
            availabilityStub.availableTimes = availabilityBodyStub.availableTimes;
            availabilityStub.overrides = availabilityBodyStub.overrides;

            availabilityRepositoryStub.save.resolves(availabilityStub);
            availabilityRedisRepositoryStub.save.resolves(availabilityBodyStub);

            const loadedAvailability = await service.create(
                teamStub.uuid,
                profileStub.id,
                availabilityBodyStub as CreateAvailabilityRequestDto
            );

            expect(availabilityRepositoryStub.save.called).true;
            expect(availabilityRedisRepositoryStub.save.called).true;
            expect(loadedAvailability).ok;
        });

        it('should be updated availability when availability entity would be updated', async () => {
            const teamStub = stubOne(Team);
            const profileStub = stubOne(Profile);
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
            availabilityRedisRepositoryStub.set.resolves(0);

            const loadedAvailability = await service.update(
                teamStub.uuid,
                profileStub.id,
                availabilityStub.id,
                updateAvailabilityStub
            );

            expect(availabilityRepositoryStub.findOneByOrFail.called).true;
            expect(availabilityRepositoryStub.update.called).true;
            expect(availabilityRedisRepositoryStub.set.called).true;
            expect(loadedAvailability).ok;
        });

        it('should be not updated availability when availability entity would be not updated', async () => {
            const profileStub = stubOne(Profile);
            const teamStub = stubOne(Team);
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
                service.update(
                    teamStub.uuid,
                    profileStub.id,
                    availabilityStub.id,
                    updateAvailabilityStub
                )
            ).rejectedWith(InternalServerErrorException);

            expect(availabilityRepositoryStub.findOneByOrFail.called).true;
            expect(availabilityRepositoryStub.update.called).true;
            expect(availabilityRedisRepositoryStub.save.called).false;
        });

        describe('Test availability patch & patchAll', () => {
            afterEach(() => {
                availabilityRepositoryStub.update.reset();
                availabilityRepositoryStub.findOneByOrFail.reset();
                availabilityRedisRepositoryStub.getAvailabilityBodyRecord.reset();
                availabilityRedisRepositoryStub.getAvailabilityBody.reset();
                availabilityRedisRepositoryStub.save.reset();
                availabilityRedisRepositoryStub.update.reset();
                availabilityRedisRepositoryStub.updateAll.reset();
            });

            it('should be patched all', async () => {
                const profileStub = stubOne(Profile);
                const teamStub = stubOne(Team);
                const availabilityBody = testMockUtil.getAvailabilityBodyMock();

                availabilityRedisRepositoryStub.updateAll.resolves(true);

                const patchAllResult = await service.patchAll(
                    teamStub.uuid,
                    profileStub.id,
                    availabilityBody
                );

                expect(patchAllResult).true;
                expect(availabilityRedisRepositoryStub.updateAll.called).true;
            });

            it('should be patched without available times nor overrides', async () => {
                const profileStub = stubOne(Profile);
                const teamStub = stubOne(Team);
                const availabilityBody = testMockUtil.getAvailabilityBodyMock();

                availabilityRedisRepositoryStub.updateAll.resolves(true);

                const patchAllResult = await service.patchAll(
                    teamStub.uuid,
                    profileStub.id,
                    {
                        availableTimes: availabilityBody.availableTimes
                    }
                );

                expect(patchAllResult).true;
                expect(availabilityRedisRepositoryStub.updateAll.called).true;
            });

            it('should be patched default as true and previous default availability should be patched default as false ', async () => {
                const profileStub = stubOne(Profile);
                const teamStub = stubOne(Team);
                const availabilityStub = stubOne(Availability, {
                    default: false
                });

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                const patchResult = await service.patch(
                    teamStub.uuid,
                    profileStub.id,
                    availabilityStub.id,
                    {
                        ...availabilityStub,
                        default: true
                    }
                );

                expect(patchResult).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.calledTwice).true;
                expect(availabilityRedisRepositoryStub.update.called).false;
            });

            it('should be patched default as true with name, timezone and previous default availability should be patched default as false ', async () => {
                const profileStub = stubOne(Profile);
                const teamStub = stubOne(Team);
                const availabilityStub = stubOne(Availability, {
                    default: false
                });

                const newTimezone = 'newTimezone';

                expect(newTimezone).not.equals(availabilityStub.timezone);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                const patchResult = await service.patch(
                    teamStub.uuid,
                    profileStub.id,
                    availabilityStub.id,
                    {
                        ...availabilityStub,
                        default: true
                    }
                );

                expect(patchResult).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.calledTwice).true;
                expect(availabilityRedisRepositoryStub.update.called).false;
            });

            it('should be thrown error when default request value is false if that target availability is default', async () => {
                const profileStub = stubOne(Profile);
                const teamStub = stubOne(Team);
                const availabilityStub = stubOne(Availability, {
                    default: true
                });

                const newTimezone = 'newTimezone';

                expect(newTimezone).not.equals(availabilityStub.timezone);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                await expect(
                    service.patch(
                        teamStub.uuid,
                        profileStub.id,
                        availabilityStub.id, {
                            ...availabilityStub,
                            default: false
                        })
                ).rejectedWith(NoDefaultAvailabilityException);

                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.called).false;
                expect(availabilityRepositoryStub.update.calledTwice).false;
                expect(availabilityRedisRepositoryStub.update.called).false;
            });

            it('should be patched name, timezone when patching default request value is false', async () => {
                const profileStub = stubOne(Profile);
                const teamStub = stubOne(Team);
                const availabilityStub = stubOne(Availability, {
                    default: false
                });

                const newTimezone = 'newTimezone';

                expect(newTimezone).not.equals(availabilityStub.timezone);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                const patchResult = await service.patch(
                    teamStub.uuid,
                    profileStub.id,
                    availabilityStub.id,
                    availabilityStub
                );

                expect(patchResult).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.called).true;
                expect(availabilityRepositoryStub.update.calledTwice).false;
                expect(availabilityRedisRepositoryStub.update.called).false;
            });

            it('should be patched availableTimes with overrides', async () => {
                const profileStub = stubOne(Profile);
                const teamStub = stubOne(Team);
                const availabilityStub = stubOne(Availability, {
                    default: false
                });
                const patchAvailabilityRequestDtoMock =
                    testMockUtil.getAvailabilityBodyMock(availabilityStub);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                const patchResult = await service.patch(
                    teamStub.uuid,
                    profileStub.id,
                    availabilityStub.id,
                    patchAvailabilityRequestDtoMock
                );

                expect(patchResult).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.called).false;
                expect(availabilityRepositoryStub.update.calledTwice).false;
                expect(availabilityRedisRepositoryStub.update.called).true;
            });

            it('should be not patched when dto has only availableTimes, not include overrides', async () => {
                const profileStub = stubOne(Profile);
                const teamStub = stubOne(Team);
                const availabilityStub = stubOne(Availability, {
                    default: false
                });
                const patchAvailabilityRequestDtoMock =
                    testMockUtil.getAvailabilityBodyMock(availabilityStub);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                const patchResult = await service.patch(
                    teamStub.uuid,
                    profileStub.id,
                    availabilityStub.id,
                    patchAvailabilityRequestDtoMock
                );

                expect(patchResult).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.update.called).false;
                expect(availabilityRepositoryStub.update.calledTwice).false;
                expect(availabilityRedisRepositoryStub.update.called).true;
            });
        });

        describe('Test availability delete', () => {
            it('should be removed availability which is not default', async () => {
                const availabilityStub = stubOne(Availability, {
                    default: false
                });
                const defaultAvailabilityStub = stubOne(Availability, {
                    default: true
                });
                const profileStub = stubOne(Profile);
                const teamStub = stubOne(Team);
                const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock();

                availabilityRepositoryStub.findOne.resolves(availabilityStub);
                availabilityRepositoryStub.findOneByOrFail.resolves(defaultAvailabilityStub);
                availabilityRepositoryStub.delete.resolves(deleteResultStub);
                eventsServiceStub._unlinksToAvailability.resolves(true);

                const result = await service.remove(
                    teamStub.uuid,
                    profileStub.id,
                    availabilityStub.id
                );

                expect(result).true;
                expect(availabilityRepositoryStub.findOne.called).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.delete.called).true;
                expect(availabilityRedisRepositoryStub.deleteAvailabilityBody.called).true;
                expect(eventsServiceStub._unlinksToAvailability.called).true;
            });

            it('should be not removed availability which is default', async () => {
                const availabilityStub = stubOne(Availability, {
                    default: true
                });
                const profileMock = stubOne(Profile);
                const teamMock = stubOne(Team);
                const deleteResultStub = TestMockUtil.getTypeormUpdateResultMock();

                availabilityRepositoryStub.findOne.resolves(availabilityStub);
                availabilityRepositoryStub.delete.resolves(deleteResultStub);

                await expect(
                    service.remove(
                        teamMock.uuid,
                        profileMock.id,
                        availabilityStub.id
                    )
                ).rejectedWith(CannotDeleteDefaultAvailabilityException);

                expect(availabilityRepositoryStub.findOne.called).true;
                expect(availabilityRepositoryStub.delete.called).false;
                expect(availabilityRedisRepositoryStub.deleteAvailabilityBody.called).false;
            });
        });

        describe('Test availability clone', () => {
            afterEach(() => {
                availabilityRepositoryStub.findOneByOrFail.reset();
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
                const profileMock = stubOne(Profile);
                const teamMock = stubOne(Team);

                const availabilityBody = testMockUtil.getAvailabilityBodyMock(availabilityStub);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                availabilityRepositoryStub.save.resolves(clonedAvailabilityStub);

                availabilityRedisRepositoryStub.clone.returns(of(availabilityBody));

                const clonedAvailability = await service.clone(
                    teamMock.id,
                    teamMock.uuid,
                    profileMock.id,
                    availabilityStub.id,
                    {
                        cloneSuffix: 'cloned'
                    }
                );

                expect(clonedAvailability).ok;
                expect(clonedAvailability.default).false;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.save.called).true;
                expect(availabilityRepositoryStub.save.getCall(0).args[0].default).false;
                expect(availabilityRepositoryStub.save.getCall(0).args[0].name).contains('cloned');
                expect(availabilityRedisRepositoryStub.clone.called).true;
            });

            it('should be cloned availability with specified name', async () => {
                const availabilityStub = stubOne(Availability, {
                    default: false
                });
                const clonedAvailabilityStub = stubOne(Availability, {
                    default: false
                });
                const profileMock = stubOne(Profile);
                const teamMock = stubOne(Team);
                const expectedSuffix = 'clonecloned';

                const availabilityBody = testMockUtil.getAvailabilityBodyMock(availabilityStub);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                clonedAvailabilityStub.name = expectedSuffix;
                availabilityRepositoryStub.save.resolves(clonedAvailabilityStub);

                availabilityRedisRepositoryStub.clone.returns(of(availabilityBody));

                const clonedAvailability = await service.clone(
                    teamMock.id,
                    teamMock.uuid,
                    profileMock.id,
                    availabilityStub.id,
                    {
                        cloneSuffix: expectedSuffix
                    }
                );

                expect(clonedAvailability).ok;
                expect(clonedAvailability.default).false;
                expect(clonedAvailability.name).contains(expectedSuffix);
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.save.called).true;
                expect(availabilityRepositoryStub.save.getCall(0).args[0].default).false;
                expect(availabilityRepositoryStub.save.getCall(0).args[0].name).contains(
                    expectedSuffix
                );
                expect(availabilityRedisRepositoryStub.clone.called).true;
            });

            it('should be cloned from default availabilitly, the clone has default false property.', async () => {
                const availabilityStub = stubOne(Availability, {
                    default: true
                });
                const clonedAvailabilityStub = stubOne(Availability, {
                    default: false
                });
                const teamMock = stubOne(Team);
                const profileMock = stubOne(Profile);

                const availabilityBody = testMockUtil.getAvailabilityBodyMock(availabilityStub);

                availabilityRepositoryStub.findOneByOrFail.resolves(availabilityStub);

                availabilityRepositoryStub.save.resolves(clonedAvailabilityStub);

                availabilityRedisRepositoryStub.clone.returns(of(availabilityBody));

                const clonedAvailability = await service.clone(
                    teamMock.id,
                    teamMock.uuid,
                    profileMock.id,
                    availabilityStub.id,
                    {
                        cloneSuffix: 'cloned'
                    }
                );

                expect(clonedAvailability).ok;
                expect(clonedAvailability.default).false;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(availabilityRepositoryStub.save.called).true;
                expect(availabilityRepositoryStub.save.getCall(0).args[0].default).false;
                expect(availabilityRedisRepositoryStub.clone.called).true;
            });
        });

        describe('Test availability link', () => {
            afterEach(() => {
                eventsServiceStub.hasOwnEventsOrThrow.reset();
                availabilityRepositoryStub.findOneByOrFail.reset();
                eventsServiceStub.linksToAvailability.reset();
            });

            it('should be linked with events', async () => {
                const teamIdMock = stubOne(Team).id;
                const profileMock = stubOne(Profile);
                const availabilityIdMock = stubOne(Availability).id;
                const eventIdMocks = stub(Event).map((_event) => _event.id);
                const defaultAvailabilityStub = stubOne(Availability, {
                    default: true,
                    profileId: profileMock.id
                });

                availabilityRepositoryStub.findOneByOrFail.resolves(defaultAvailabilityStub);

                await service.linkToEvents(profileMock.id, teamIdMock, availabilityIdMock, eventIdMocks);

                expect(eventsServiceStub.hasOwnEventsOrThrow.called).true;
                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(eventsServiceStub.linksToAvailability.called).true;
            });
        });

        describe('Test availability unlink', () => {
            afterEach(() => {
                availabilityRepositoryStub.findOneByOrFail.reset();
                eventsServiceStub.unlinksToAvailability.reset();
            });

            it('should be unlinked from availability', async () => {
                const userIdMock = stubOne(User).id;
                const availabilityIdMock = stubOne(Availability).id;
                const defaultAvailabilityStub = stubOne(Availability, {
                    default: true
                });

                availabilityRepositoryStub.findOneByOrFail.resolves(defaultAvailabilityStub);

                await service.unlinkToEvents(userIdMock, availabilityIdMock);

                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(eventsServiceStub.unlinksToAvailability.called).true;
            });

            it('should be not unlinked from default availability', async () => {
                const userIdMock = stubOne(User).id;
                const defaultAvailabilityStub = stubOne(Availability, {
                    default: true
                });

                availabilityRepositoryStub.findOneByOrFail.resolves(defaultAvailabilityStub);

                await expect(
                    service.unlinkToEvents(userIdMock, defaultAvailabilityStub.id)
                ).rejectedWith(CannotUnlinkDefaultAvailabilityException);

                expect(availabilityRepositoryStub.findOneByOrFail.called).true;
                expect(eventsServiceStub.unlinksToAvailability.called).false;
            });
        });
    });
});
