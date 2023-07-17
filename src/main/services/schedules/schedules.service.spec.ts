import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { UtilService } from '@services/util/util.service';
import { EventsService } from '@services/events/events.service';
import { SchedulesRedisRepository } from '@services/schedules/schedules.redis-repository';
import { GoogleCalendarIntegrationsService } from '@services/integrations/google-integration/google-calendar-integrations/google-calendar-integrations.service';
import { AvailabilityRedisRepository } from '@services/availability/availability.redis-repository';
import { User } from '@entity/users/user.entity';
import { Event } from '@entity/events/event.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { GoogleIntegrationSchedule } from '@entity/schedules/google-integration-schedule.entity';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { Availability } from '@entity/availability/availability.entity';
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
    let availabilityRedisRepositoryStub: sinon.SinonStubbedInstance<AvailabilityRedisRepository>;
    let scheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<Schedule>>;
    let googleIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegrationSchedule>>;
    let loggerStub: sinon.SinonStubbedInstance<Logger>;

    before(async () => {

        utilServiceStub = sinon.createStubInstance(UtilService);
        eventsServiceStub = sinon.createStubInstance(EventsService);

        googleCalendarIntegrationsServiceStub = sinon.createStubInstance(GoogleCalendarIntegrationsService);
        schedulesRedisRepositoryStub = sinon.createStubInstance(SchedulesRedisRepository);
        availabilityRedisRepositoryStub = sinon.createStubInstance(AvailabilityRedisRepository);
        scheduleRepositoryStub = sinon.createStubInstance<Repository<Schedule>>(Repository);
        googleIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<GoogleIntegrationSchedule>>(
            Repository
        );
        loggerStub = sinon.createStubInstance(Logger);

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
                    provide: AvailabilityRedisRepository,
                    useValue: availabilityRedisRepositoryStub
                },
                {
                    provide: getRepositoryToken(Schedule),
                    useValue: scheduleRepositoryStub
                },
                {
                    provide: getRepositoryToken(GoogleIntegrationSchedule),
                    useValue: googleIntegrationScheduleRepositoryStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
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
            utilServiceStub.localizeDateTime.reset();
            googleCalendarIntegrationsServiceStub.findOne.reset();
            googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.reset();
            schedulesRedisRepositoryStub.save.reset();
            scheduleRepositoryStub.save.reset();
            scheduleRepositoryStub.findBy.reset();
            scheduleRepositoryStub.findOneBy.reset();
            scheduleRepositoryStub.findOneByOrFail.reset();
            scheduleRepositoryStub.update.reset();
            googleIntegrationScheduleRepositoryStub.findOneBy.reset();

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
            const scheduleBodyStub = testMockUtil.getScheduleBodyMock();

            scheduleRepositoryStub.findOneByOrFail.resolves(scheduleStub);
            schedulesRedisRepositoryStub.getScheduleBody.returns(of(scheduleBodyStub));

            const fetchedScheduledEvent = await firstValueFrom(
                service.findOne(scheduleStub.uuid)
            );

            expect(fetchedScheduledEvent).ok;
            expect(scheduleRepositoryStub.findOneByOrFail.called).true;
        });

        it('should be created scheduled event', async () => {

            const userSettingStub = stubOne(UserSetting);
            const userMock = stubOne(User, {
                userSetting: userSettingStub
            });
            const availabilityMock = stubOne(Availability);
            const eventStub = stubOne(Event, {
                availability: availabilityMock
            });
            const scheduleStub = stubOne(Schedule);
            const googleCalendarIntegrationStub = stubOne(GoogleCalendarIntegration);
            const availabilityBodyMock = testMockUtil.getAvailabilityBodyMock();
            const googleScheduleMock = testMockUtil.getGoogleScheduleMock();

            eventsServiceStub.findOneByUserWorkspaceAndUUID.resolves(eventStub);
            utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);
            googleCalendarIntegrationsServiceStub.findOne.returns(of(googleCalendarIntegrationStub));
            googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.resolves(googleScheduleMock);
            googleCalendarIntegrationsServiceStub.patchGoogleCalendarEvent.resolves(googleScheduleMock);

            const validateStub = serviceSandbox.stub(service, 'validate').returns(of(scheduleStub));

            scheduleRepositoryStub.save.resolves(scheduleStub);
            schedulesRedisRepositoryStub.save.returns(of(scheduleStub));

            availabilityRedisRepositoryStub.getAvailabilityBody.resolves(availabilityBodyMock);
            utilServiceStub.getPatchedScheduledEvent.returns(scheduleStub);

            const createdSchedule = await firstValueFrom(
                service._create(
                    {
                        getRepository: () => scheduleRepositoryStub
                    } as unknown as any,
                    userMock.workspace as string,
                    eventStub.uuid,
                    scheduleStub,
                    userSettingStub.preferredTimezone,
                    userMock
                )
            );

            expect(createdSchedule).ok;
            expect(eventsServiceStub.findOneByUserWorkspaceAndUUID.called).true;
            expect(availabilityRedisRepositoryStub.getAvailabilityBody.called).true;
            expect(utilServiceStub.getPatchedScheduledEvent.called).true;
            expect(googleCalendarIntegrationsServiceStub.findOne.called).true;
            expect(googleCalendarIntegrationsServiceStub.createGoogleCalendarEvent.called).true;
            expect(googleCalendarIntegrationsServiceStub.patchGoogleCalendarEvent.called).true;
            expect(validateStub.called).true;
            expect(scheduleRepositoryStub.save.called).true;
            expect(schedulesRedisRepositoryStub.save.called).true;
        });

        it('should be updated scheduled event', async () => {

            const scheduleStub = stubOne(Schedule);

            const updateResultMock = TestMockUtil.getTypeormUpdateResultMock();
            scheduleRepositoryStub.update.resolves(updateResultMock);

            const scheduleUpdateResult = await firstValueFrom(
                service._update(
                    {
                        getRepository: () => scheduleRepositoryStub
                    } as unknown as any,
                    scheduleStub.id,
                    {
                        color: '#000000'
                    }
                )
            );

            expect(scheduleRepositoryStub.update.called).true;
            expect(scheduleUpdateResult).true;

        });

        it('should be passed when there is no conflicted schedule ', async () => {

            const scheduleTimeMock = testMockUtil.getScheduleTimeMock();
            const timezoneMock = stubOne(UserSetting).preferredTimezone;
            const scheduleMock = stubOne(Schedule, scheduleTimeMock);
            const availabilityBodyMock = testMockUtil.getAvailabilityBodyMock();

            const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(false);
            const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithOverrides').returns(true);
            const _isTimeOverlappingWithAvailableTimesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimes').returns(true);

            scheduleRepositoryStub.findOneBy.resolves(null);
            googleIntegrationScheduleRepositoryStub.findOneBy.resolves(null);

            const validatedSchedule = await firstValueFrom(
                service.validate(
                    scheduleMock,
                    timezoneMock,
                    availabilityBodyMock
                )
            );

            expect(validatedSchedule).ok;
            expect(scheduleRepositoryStub.findOneBy.called).true;
            expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;

            expect(_isPastTimestampStub.called).true;
            expect(_isTimeOverlappingWithOverridesStub.called).true;
            expect(_isTimeOverlappingWithAvailableTimesStub.called).true;
        });

        it('should be not passed when requested schedule has old start/end datetime', () => {

            const timezoneMock = stubOne(UserSetting).preferredTimezone;
            const _1minBefore = new Date();
            _1minBefore.setMinutes(_1minBefore.getMinutes() - 5);

            const invalidScheduleTimeMock = testMockUtil.getScheduleTimeMock(_1minBefore);
            const scheduleMock = stubOne(Schedule, invalidScheduleTimeMock);
            const availabilityBodyMock = testMockUtil.getAvailabilityBodyMock();

            const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(true);
            const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithOverrides').returns(true);
            const _isTimeOverlappingWithAvailableTimesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimes').returns(true);

            expect(() => service.validate(scheduleMock, timezoneMock, availabilityBodyMock)).throws(CannotCreateByInvalidTimeRange);

            expect(scheduleRepositoryStub.findOneBy.called).false;
            expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;

            expect(_isPastTimestampStub.called).true;
            expect(_isTimeOverlappingWithOverridesStub.called).true;
            expect(_isTimeOverlappingWithAvailableTimesStub.called).true;
        });

        it('should be not passed when there are conflicted schedules ', async () => {

            const scheduleTimeMock = testMockUtil.getScheduleTimeMock();
            const scheduleMock = stubOne(Schedule, scheduleTimeMock);
            const conflictedScheduleStub = stubOne(Schedule);
            const availabilityBodyMock = testMockUtil.getAvailabilityBodyMock();
            const timezoneMock = stubOne(UserSetting).preferredTimezone;

            scheduleRepositoryStub.findOneBy.resolves(conflictedScheduleStub);
            googleIntegrationScheduleRepositoryStub.findOneBy.resolves(null);

            const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(false);
            const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithOverrides').returns(true);
            const _isTimeOverlappingWithAvailableTimesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimes').returns(true);

            await expect(
                firstValueFrom(
                    service.validate(
                        scheduleMock,
                        timezoneMock,
                        availabilityBodyMock
                    )
                )
            ).rejectedWith(CannotCreateByInvalidTimeRange);

            expect(scheduleRepositoryStub.findOneBy.called).true;
            expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;

            expect(_isPastTimestampStub.called).true;
            expect(_isTimeOverlappingWithOverridesStub.called).true;
            expect(_isTimeOverlappingWithAvailableTimesStub.called).true;
        });

        it('should be not passed when there are conflicted schedules ', async () => {

            const scheduleTimeMock = testMockUtil.getScheduleTimeMock();
            const scheduleMock = stubOne(Schedule, scheduleTimeMock);
            const googleCalendarIntegrationMock = stubOne(GoogleCalendarIntegration);
            const conflictedGoogleIntegrationScheduleStub = stubOne(GoogleIntegrationSchedule, {
                googleCalendarIntegration: googleCalendarIntegrationMock,
                googleCalendarIntegrationId: googleCalendarIntegrationMock.id
            });
            const availabilityBodyMock = testMockUtil.getAvailabilityBodyMock();
            const timezoneMock = stubOne(UserSetting).preferredTimezone;

            scheduleRepositoryStub.findOneBy.resolves(null);
            googleIntegrationScheduleRepositoryStub.findOneBy.resolves(conflictedGoogleIntegrationScheduleStub);

            const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(false);
            const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithOverrides').returns(true);
            const _isTimeOverlappingWithAvailableTimesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimes').returns(true);

            await expect(
                firstValueFrom(
                    service.validate(
                        scheduleMock,
                        timezoneMock,
                        availabilityBodyMock,
                        googleCalendarIntegrationMock.id
                    )
                )
            ).rejectedWith(CannotCreateByInvalidTimeRange);

            expect(scheduleRepositoryStub.findOneBy.called).true;
            expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).true;

            expect(_isPastTimestampStub.called).true;
            expect(_isTimeOverlappingWithOverridesStub.called).true;
            expect(_isTimeOverlappingWithAvailableTimesStub.called).true;
        });

        it('should be passed when new schedule is not overlapping with host override date but overlapping with available times and no conflicted schedules', async () => {

            const scheduleTimeMock = testMockUtil.getScheduleTimeMock();
            const scheduleMock = stubOne(Schedule, scheduleTimeMock);
            const availabilityBodyMock = testMockUtil.getAvailabilityBodyMock();
            const timezoneMock = stubOne(UserSetting).preferredTimezone;

            scheduleRepositoryStub.findOneBy.resolves(null);
            googleIntegrationScheduleRepositoryStub.findOneBy.resolves(null);

            const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(false);
            const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithOverrides').returns(false);
            const _isTimeOverlappingWithAvailableTimesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimes').returns(true);

            const validatedSchedule = await firstValueFrom(
                service.validate(
                    scheduleMock,
                    timezoneMock,
                    availabilityBodyMock
                )
            );

            expect(validatedSchedule).ok;
            expect(scheduleRepositoryStub.findOneBy.called).true;
            expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;

            expect(_isPastTimestampStub.called).true;
            expect(_isTimeOverlappingWithOverridesStub.called).true;
            expect(_isTimeOverlappingWithAvailableTimesStub.called).true;
        });

        it('should be passed when new schedule is overlapping with host override date and no conflicted schedules', async () => {

            const scheduleTimeMock = testMockUtil.getScheduleTimeMock();
            const scheduleMock = stubOne(Schedule, scheduleTimeMock);
            const availabilityBodyMock = testMockUtil.getAvailabilityBodyMock();
            const timezoneMock = stubOne(UserSetting).preferredTimezone;

            scheduleRepositoryStub.findOneBy.resolves(null);
            googleIntegrationScheduleRepositoryStub.findOneBy.resolves(null);

            const _isPastTimestampStub = serviceSandbox.stub(service, '_isPastTimestamp').returns(false);
            const _isTimeOverlappingWithOverridesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithOverrides').returns(true);
            const _isTimeOverlappingWithAvailableTimesStub = serviceSandbox.stub(service, '_isTimeOverlappingWithAvailableTimes').returns(false);

            const validatedSchedule = await firstValueFrom(
                service.validate(
                    scheduleMock,
                    timezoneMock,
                    availabilityBodyMock
                )
            );

            expect(validatedSchedule).ok;
            expect(scheduleRepositoryStub.findOneBy.called).true;
            expect(googleIntegrationScheduleRepositoryStub.findOneBy.called).false;

            expect(_isPastTimestampStub.called).true;
            expect(_isTimeOverlappingWithOverridesStub.called).true;
            expect(_isTimeOverlappingWithAvailableTimesStub.called).true;
        });

        it('should be returned true for no overlapping with overrides', () => {

            const timezoneMock = stubOne(UserSetting).preferredTimezone;
            const overridedAvailabilityTimeMock = testMockUtil.getOverridedAvailabilityTimeMock();
            const timeRangeMock = overridedAvailabilityTimeMock.timeRanges[0];

            const startDateTimeStub = new Date(timeRangeMock.startTime);
            startDateTimeStub.setHours(startDateTimeStub.getHours() + 1);
            const endDateTimeStub = new Date(timeRangeMock.endTime);
            endDateTimeStub.setHours(endDateTimeStub.getHours() - 1);
            const startDateTimestampMock = startDateTimeStub.getTime();
            const endDateTimestampMock = endDateTimeStub.getTime();

            utilServiceStub.localizeDateTime.onFirstCall().returns(startDateTimeStub);
            utilServiceStub.localizeDateTime.onSecondCall().returns(endDateTimeStub);

            const isTimeOverlappedWithOverrides = service._isTimeOverlappingWithOverrides(
                timezoneMock,
                [overridedAvailabilityTimeMock],
                startDateTimestampMock,
                endDateTimestampMock
            );

            expect(isTimeOverlappedWithOverrides).true;
            expect(utilServiceStub.localizeDateTime.calledTwice).true;
        });

        it('should be returned true with empty overrides', () => {

            const timezoneMock = stubOne(UserSetting).preferredTimezone;
            const timestampDummy = Date.now();

            const isTimeOverlappedWithOverrides = service._isTimeOverlappingWithOverrides(
                timezoneMock,
                [],
                timestampDummy,
                timestampDummy
            );

            expect(isTimeOverlappedWithOverrides).true;
            expect(utilServiceStub.localizeDateTime.called).false;
        });
    });

});
