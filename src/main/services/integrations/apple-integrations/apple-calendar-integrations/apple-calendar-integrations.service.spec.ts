import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AppleIntegrationFacadeService } from '@services/integrations/apple-integrations/apple-integration-facade.service';
import { AppleConverterService } from '@services/integrations/apple-integrations/apple-converter/apple-converter.service';
import { AppleCalDAVIntegration } from '@entity/integrations/apple/apple-caldav-integration.entity';
import { AppleCalDAVCalendarIntegration } from '@entity/integrations/apple/apple-caldav-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { AppleCalendarIntegrationsService } from './apple-calendar-integrations.service';

const testMockUtil = new TestMockUtil();

describe('AppleCalendarIntegrationsService', () => {
    let module: TestingModule;
    let service: AppleCalendarIntegrationsService;

    let appleIntegrationFacadeStub: sinon.SinonStubbedInstance<AppleIntegrationFacadeService>;
    let appleConverterStub: sinon.SinonStubbedInstance<AppleConverterService>;

    let appleCalDAVCalendarIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<AppleCalDAVCalendarIntegration>>;
    let appleCalDAVIntegrationScheduleRepositoryStub: sinon.SinonStubbedInstance<Repository<AppleCalDAVIntegrationSchedule>>;

    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    before(async () => {

        appleIntegrationFacadeStub = sinon.createStubInstance(AppleIntegrationFacadeService);
        appleConverterStub = sinon.createStubInstance(AppleConverterService);

        appleCalDAVCalendarIntegrationRepositoryStub = sinon.createStubInstance<Repository<AppleCalDAVCalendarIntegration>>(Repository);
        appleCalDAVIntegrationScheduleRepositoryStub = sinon.createStubInstance<Repository<AppleCalDAVIntegrationSchedule>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                AppleCalendarIntegrationsService,
                {
                    provide: AppleIntegrationFacadeService,
                    useValue: appleIntegrationFacadeStub
                },
                {
                    provide: AppleConverterService,
                    useValue: appleConverterStub
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
                    provide: getRepositoryToken(AppleCalDAVIntegrationSchedule),
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
            const scheduleStubs = stub(AppleCalDAVIntegrationSchedule);

            appleIntegrationFacadeStub.generateCalDAVClient.resolves(calDAVClientMock);
            appleIntegrationFacadeStub.searchSchedules.resolves(calDAVCalendarObjectStubs);
            appleConverterStub.convertCalDAVCalendarObjectToAppleCalDAVIntegrationSchedules.returns(scheduleStubs);

            appleCalDAVIntegrationScheduleRepositoryStub.save.resolves();
            appleCalDAVIntegrationScheduleRepositoryStub.findBy.resolves(scheduleStubs);
        });

        afterEach(() => {
            appleIntegrationFacadeStub.generateCalDAVClient.reset();
            appleIntegrationFacadeStub.searchSchedules.reset();
            appleConverterStub.convertCalDAVCalendarObjectToAppleCalDAVIntegrationSchedules.reset();

            appleCalDAVIntegrationScheduleRepositoryStub.save.reset();
            appleCalDAVIntegrationScheduleRepositoryStub.findBy.resolves();
        });

        it('should be synchronized for Apple WebDAV calendar items', async () => {

            const appleIntegrationMock = stubOne(AppleCalDAVIntegration);
            const appleCalDAVCalendarIntegrationMock = stubOne(AppleCalDAVCalendarIntegration);
            const userMock = stubOne(User);
            const userSettingMock = stubOne(UserSetting);

            await service.synchronize(
                datasourceMock as EntityManager,
                appleIntegrationMock,
                appleCalDAVCalendarIntegrationMock,
                userMock,
                userSettingMock
            );

            expect(appleIntegrationFacadeStub.generateCalDAVClient.called).true;
            expect(appleIntegrationFacadeStub.searchSchedules.called).true;
            expect(appleConverterStub.convertCalDAVCalendarObjectToAppleCalDAVIntegrationSchedules.called).true;

            expect(appleCalDAVIntegrationScheduleRepositoryStub.save.called).true;
            expect(appleCalDAVIntegrationScheduleRepositoryStub.findBy.called).true;
        });
    });

});
