import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CoreAppleConverterService } from '@services/converters/apple/core-apple-converter.service';
import { AppleIntegrationFacadeService } from '@services/integrations/apple-integrations/apple-integration-facade.service';
import { AppleCalDAVIntegration } from '@entities/integrations/apple/apple-caldav-integration.entity';
import { AppleCalDAVCalendarIntegration } from '@entities/integrations/apple/apple-caldav-calendar-integration.entity';
import { UserSetting } from '@entities/users/user-setting.entity';
import { AppleCalDAVIntegrationScheduledEvent } from '@entities/integrations/apple/apple-caldav-integration-scheduled-event.entity';
import { Profile } from '@entities/profiles/profile.entity';
import { TeamSetting } from '@entities/teams/team-setting.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { AppleCalendarIntegrationsService } from './apple-calendar-integrations.service';

const testMockUtil = new TestMockUtil();

describe('AppleCalendarIntegrationsService', () => {
    let module: TestingModule;
    let service: AppleCalendarIntegrationsService;

    let appleIntegrationFacadeStub: sinon.SinonStubbedInstance<AppleIntegrationFacadeService>;
    let coreAppleConverterStub: sinon.SinonStubbedInstance<CoreAppleConverterService>;

    let appleCalDAVCalendarIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<AppleCalDAVCalendarIntegration>>;
    let appleCalDAVIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<AppleCalDAVIntegrationScheduledEvent>>;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    before(async () => {

        appleIntegrationFacadeStub = sinon.createStubInstance(AppleIntegrationFacadeService);
        coreAppleConverterStub = sinon.createStubInstance(CoreAppleConverterService);

        appleCalDAVCalendarIntegrationRepositoryStub = sinon.createStubInstance<Repository<AppleCalDAVCalendarIntegration>>(Repository);
        appleCalDAVIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<AppleCalDAVIntegrationScheduledEvent>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                AppleCalendarIntegrationsService,
                {
                    provide: AppleIntegrationFacadeService,
                    useValue: appleIntegrationFacadeStub
                },
                {
                    provide: CoreAppleConverterService,
                    useValue: coreAppleConverterStub
                },
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(AppleCalDAVCalendarIntegration),
                    useValue: appleCalDAVCalendarIntegrationRepositoryStub
                },
                {
                    provide: getRepositoryToken(AppleCalDAVIntegrationScheduledEvent),
                    useValue: appleCalDAVIntegrationScheduleRepositoryStub
                }
            ]
        }).compile();

        service = module.get<AppleCalendarIntegrationsService>(AppleCalendarIntegrationsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test Synchronizing', () => {
        beforeEach(() => {

            const calDAVClientMock = testMockUtil.getCalDavClientMock();
            const calDAVCalendarObjectStubs = testMockUtil.getCalDavObjectMocks();
            const scheduleStubs = stub(AppleCalDAVIntegrationScheduledEvent);

            appleIntegrationFacadeStub.generateCalDAVClient.resolves(calDAVClientMock);
            appleIntegrationFacadeStub.searchScheduledEvents.resolves(calDAVCalendarObjectStubs);
            coreAppleConverterStub.convertCalDAVCalendarObjectToAppleCalDAVIntegrationScheduledEvents.returns(scheduleStubs);

            appleCalDAVIntegrationScheduleRepositoryStub.save.resolves();
            appleCalDAVIntegrationScheduleRepositoryStub.findBy.resolves(scheduleStubs);
        });

        afterEach(() => {
            appleIntegrationFacadeStub.generateCalDAVClient.reset();
            appleIntegrationFacadeStub.searchScheduledEvents.reset();
            coreAppleConverterStub.convertCalDAVCalendarObjectToAppleCalDAVIntegrationScheduledEvents.reset();

            appleCalDAVIntegrationScheduleRepositoryStub.save.reset();
            appleCalDAVIntegrationScheduleRepositoryStub.findBy.resolves();
        });

        it('should be synchronized for Apple WebDAV calendar items', async () => {

            const appleIntegrationMock = stubOne(AppleCalDAVIntegration);
            const appleCalDAVCalendarIntegrationMock = stubOne(AppleCalDAVCalendarIntegration);
            const profileMock = stubOne(Profile);
            const userSettingMock = stubOne(UserSetting);
            const teamSettingMock = stubOne(TeamSetting);

            await service._synchronizeWithCalDAVCalendars(
                datasourceMock as unknown as EntityManager,
                appleIntegrationMock,
                appleCalDAVCalendarIntegrationMock,
                profileMock,
                userSettingMock,
                teamSettingMock
            );

            expect(appleIntegrationFacadeStub.generateCalDAVClient.called).true;
            expect(appleIntegrationFacadeStub.searchScheduledEvents.called).true;
            expect(coreAppleConverterStub.convertCalDAVCalendarObjectToAppleCalDAVIntegrationScheduledEvents.called).true;

            expect(appleCalDAVIntegrationScheduleRepositoryStub.save.called).true;
            expect(appleCalDAVIntegrationScheduleRepositoryStub.findBy.called).true;
        });
    });

});
