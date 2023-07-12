import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { CannotCreateByInvalidTimeRange } from '@app/exceptions/schedules/cannot-create-by-invalid-time-range.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { SchedulesService } from './schedules.service';

const testMockUtil = new TestMockUtil();

describe('SchedulesService', () => {
    let service: SchedulesService;

    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;
    let eventsServiceStub: sinon.SinonStubbedInstance<EventsService>;

    let googleCalendarIntegrationsServiceStub: sinon.SinonStubbedInstance<GoogleCalendarIntegrationsService>;
    let schedulesRedisRepositoryStub: sinon.SinonStubbedInstance<SchedulesRedisRepository>;
    let scheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<Schedule>>;
    let googleIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegrationSchedule>>;

    before(async () => {

        utilServiceStub = sinon.createStubInstance(UtilService);
        eventsServiceStub = sinon.createStubInstance(EventsService);

        googleCalendarIntegrationsServiceStub = sinon.createStubInstance(GoogleCalendarIntegrationsService);
        schedulesRedisRepositoryStub = sinon.createStubInstance(SchedulesRedisRepository);
        scheduleRepositoryStub = sinon.createStubInstance<Repository<Schedule>>(Repository);
        googleIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<GoogleIntegrationSchedule>>(
            Repository
        );

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SchedulesService,
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: EventsService,
                    useValue: eventsServiceStub
                },
                {
                    provide: GoogleCalendarIntegrationsService,
                    useValue: googleCalendarIntegrationsServiceStub
                },
                {
                    provide: SchedulesRedisRepository,
                    useValue: schedulesRedisRepositoryStub
                },
                {
                    provide: getRepositoryToken(Schedule),
                    useValue: scheduleRepositoryStub
                },
                {
                    provide: getRepositoryToken(GoogleIntegrationSchedule),
                    useValue: googleIntegrationScheduleRepositoryStub
                }
            ]
        }).compile();

        service = module.get<SchedulesService>(SchedulesService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test Scheduled event CRUD', () => {

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            eventsServiceStub.findOneByUserWorkspaceAndUUID.reset();
            utilServiceStub.getPatchedScheduledEvent.reset();
            googleCalendarIntegrationsServiceStub.findOne.reset();
            googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.reset();
            schedulesRedisRepositoryStub.save.reset();
            scheduleRepositoryStub.save.reset();
            scheduleRepositoryStub.findBy.reset();
            scheduleRepositoryStub.findOneBy.reset();
            scheduleRepositoryStub.findOneByOrFail.reset();

            serviceSandbox.restore();
        });

        it('should be searched scheduled events', async () => {

            const workspaceMock = stubOne(UserSetting).workspace;
            const eventUUIDMock = stubOne(Event).uuid;
            const scheduleStubs = stub(Schedule);
            const googleIntegartionScheduleStubs = stub(GoogleIntegrationSchedule);

            scheduleRepositoryStub.findBy.resolves(scheduleStubs);
            googleIntegrationScheduleRepositoryStub.findBy.resolves(googleIntegartionScheduleStubs);

            const searchedSchedules = await firstValueFrom(
                service.search({
                    workspace: workspaceMock,
                    eventUUID: eventUUIDMock
                })
            );

            expect(searchedSchedules).ok;
            expect(searchedSchedules.length).greaterThan(0);
            expect(scheduleRepositoryStub.findBy.called).true;
        });

        it('should be fetched scheduled event one', async () => {

            const scheduleStub = stubOne(Schedule);

            scheduleRepositoryStub.findOneByOrFail.resolves(scheduleStub);

            const fetchedScheduledEvent = await firstValueFrom(
                service.findOne(scheduleStub.uuid)
            );

            expect(fetchedScheduledEvent).ok;
            expect(scheduleRepositoryStub.findOneByOrFail.called).true;
        });

        it('should be created scheduled event', async () => {

            const userSettingStub = stubOne(UserSetting);
            const userStub = stubOne(User, {
                userSetting: userSettingStub
            });
            const eventStub = stubOne(Event);
            const scheduleStub = stubOne(Schedule);
            const googleCalendarIntegrationStub = stubOne(GoogleCalendarIntegration);

            eventsServiceStub.findOneByUserWorkspaceAndUUID.resolves(eventStub);
            utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);
            googleCalendarIntegrationsServiceStub.findOne.returns(of(googleCalendarIntegrationStub));
            googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.resolves();

            const validateStub = serviceSandbox.stub(service, 'validate').returns(of(scheduleStub));

            scheduleRepositoryStub.save.resolves(scheduleStub);
            schedulesRedisRepositoryStub.save.returns(of(scheduleStub));

            const createdSchedule = await firstValueFrom(
                service._create(
                    {
                        getRepository: () => scheduleRepositoryStub
                    } as unknown as any,
                    userStub.workspace as string,
                    eventStub.uuid,
                    scheduleStub,
                    userSettingStub.preferredTimezone
                )
            );

            expect(createdSchedule).ok;
            expect(eventsServiceStub.findOneByUserWorkspaceAndUUID.called).true;
            expect(utilServiceStub.getPatchedScheduledEvent.called).true;
            expect(googleCalendarIntegrationsServiceStub.findOne.called).true;
            expect(googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.called).true;
            expect(validateStub.called).true;
            expect(scheduleRepositoryStub.save.called).true;
            expect(schedulesRedisRepositoryStub.save.called).true;
        });

        it('should be passed when there is no conflicted schedule ', async () => {

            const scheduleTimeMock = testMockUtil.getScheduleTimeMock();
            const scheduleMock = stubOne(Schedule, scheduleTimeMock);

            scheduleRepositoryStub.findOneBy.resolves(null);

            const validatedSchedule = await firstValueFrom(
                service.validate(
                    scheduleMock
                )
            );

            expect(validatedSchedule).ok;
            expect(scheduleRepositoryStub.findOneBy.called).true;
        });

        it('should be not passed when requested schedule has old start/end datetime', () => {

            const _1minBefore = new Date();
            _1minBefore.setMinutes(_1minBefore.getMinutes() - 5);

            const invalidScheduleTimeMock = testMockUtil.getScheduleTimeMock(_1minBefore);
            const scheduleMock = stubOne(Schedule, invalidScheduleTimeMock);

            expect(() => service.validate(scheduleMock)).throws(CannotCreateByInvalidTimeRange);

            expect(scheduleRepositoryStub.findOneBy.called).false;
        });

        it('should be not passed when there are conflicted schedules ', async () => {

            const scheduleTimeMock = testMockUtil.getScheduleTimeMock();
            const scheduleMock = stubOne(Schedule, scheduleTimeMock);
            const conflictedScheduleStub = stubOne(Schedule);

            scheduleRepositoryStub.findOneBy.resolves(conflictedScheduleStub);

            await expect(
                firstValueFrom(
                    service.validate(
                        scheduleMock
                    )
                )
            ).rejectedWith(CannotCreateByInvalidTimeRange);

            expect(scheduleRepositoryStub.findOneBy.called).true;
        });
    });

});
