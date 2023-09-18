import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as tsdavModule from 'tsdav';
import { AppleConverterService } from '@services/integrations/apple-integrations/apple-converter/apple-converter.service';
import { AppleIntegrationsSchedulesService } from '@services/integrations/apple-integrations/apple-integrations-schedules/apple-integrations-schedules.service';
import { AppleCalDAVIntegration } from '@entity/integrations/apple/apple-caldav-integration.entity';

import { User } from '@entity/users/user.entity';
import { AppleCalDAVCalendarIntegration } from '@entity/integrations/apple/apple-caldav-calendar-integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { AlreadyIntegratedCalendar } from '@app/exceptions/integrations/already-integrated-calendar.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { AppleIntegrationsService } from './apple-integrations.service';

const testMockUtil = new TestMockUtil();

describe('AppleIntegrationsService', () => {
    let service: AppleIntegrationsService;

    let tsdavModuleStub: sinon.SinonStub;
    let tsdavModuleDAVClientLoginStub: sinon.SinonStub;
    let tsdavModuleDAVClientFetchCalendarStub: sinon.SinonStub;
    let tsdavModuleDAVClientfetchCalendarObjectsStub: sinon.SinonStub;
    let tsdavModuleGetBasicAuthHeadersStub: sinon.SinonStub;

    let appleIntegrationsSchedulesServiceStub: sinon.SinonStubbedInstance<AppleIntegrationsSchedulesService>;
    let appleConverterServiceStub: sinon.SinonStubbedInstance<AppleConverterService>;

    let appleCalDAVIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<AppleCalDAVIntegration>>;

    before(async () => {

        tsdavModuleStub = sinon.stub(tsdavModule, 'default');
        tsdavModuleDAVClientLoginStub = sinon.stub();
        tsdavModuleDAVClientFetchCalendarStub = sinon.stub();
        tsdavModuleDAVClientfetchCalendarObjectsStub = sinon.stub();
        tsdavModuleGetBasicAuthHeadersStub = sinon.stub(tsdavModule, 'getBasicAuthHeaders');

        const calDavCalendarStubs = testMockUtil.getCalDavMocks();
        tsdavModuleDAVClientFetchCalendarStub.resolves(calDavCalendarStubs);
        const calDavCalendarObjectStub = testMockUtil.getCalDAVCalendarObjectMock();
        tsdavModuleDAVClientfetchCalendarObjectsStub.resolves([calDavCalendarObjectStub]);

        tsdavModuleGetBasicAuthHeadersStub.returns({});

        sinon.stub(tsdavModule, 'DAVClient').returns({
            login: tsdavModuleDAVClientLoginStub,
            fetchCalendars: tsdavModuleDAVClientFetchCalendarStub,
            fetchCalendarObjects: tsdavModuleDAVClientfetchCalendarObjectsStub
        });

        appleCalDAVIntegrationRepositoryStub = sinon.createStubInstance<Repository<AppleCalDAVIntegration>>(Repository);

        appleIntegrationsSchedulesServiceStub = sinon.createStubInstance(AppleIntegrationsSchedulesService);
        appleConverterServiceStub = sinon.createStubInstance(AppleConverterService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppleIntegrationsService,
                {
                    provide: AppleConverterService,
                    useValue: appleConverterServiceStub
                },
                {
                    provide: AppleIntegrationsSchedulesService,
                    useValue: appleIntegrationsSchedulesServiceStub
                },
                {
                    provide: getRepositoryToken(AppleCalDAVIntegration),
                    useValue: appleCalDAVIntegrationRepositoryStub
                }
            ]
        }).compile();

        service = module.get<AppleIntegrationsService>(AppleIntegrationsService);
    });

    after(() => {
        tsdavModuleStub.reset();
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test to create apple cal dav integration', () => {

        afterEach(() => {
            tsdavModuleDAVClientLoginStub.reset();
            tsdavModuleDAVClientFetchCalendarStub.reset();
            tsdavModuleGetBasicAuthHeadersStub.reset();
            appleConverterServiceStub.convertCalDAVCalendarToAppleCalendarIntegration.reset();
        });

        it('should be created a Apple cal dav integration', async () => {

            const userSettingMock = stubOne(UserSetting);
            const userMock = stubOne(User, {
                userSetting: userSettingMock
            });
            const appleCalDAVCredentialMock = testMockUtil.getAppleCalDavCredentialMock();
            const timezoneMock = 'Asia/Seoul';

            const appleCalDavCalendarIntegrationStubs = stub(AppleCalDAVCalendarIntegration);
            const appleCalDavIntegrationStub = stubOne(AppleCalDAVIntegration, {
                appleCalDAVCalendarIntegrations: appleCalDavCalendarIntegrationStubs
            });
            const convertedAppleCalDAVCalndarIntegrationStub = stub(AppleCalDAVCalendarIntegration);
            const appleCalDAVIntegrationScheduleStubs = stub(AppleCalDAVIntegrationSchedule);

            appleCalDAVIntegrationRepositoryStub.save.resolves(appleCalDavIntegrationStub);
            appleCalDAVIntegrationRepositoryStub.findOneBy.resolves(null);
            appleConverterServiceStub.convertCalDAVCalendarToAppleCalendarIntegration.resolves(convertedAppleCalDAVCalndarIntegrationStub);
            appleConverterServiceStub.convertCalDAVCalendarObjectsToAppleCalDAVIntegrationSchedules.resolves(appleCalDAVIntegrationScheduleStubs);

            await service.create(
                userMock,
                userSettingMock,
                appleCalDAVCredentialMock,
                timezoneMock
            );

            expect(tsdavModuleDAVClientLoginStub.called).true;
            expect(tsdavModuleDAVClientFetchCalendarStub.called).true;
            expect(tsdavModuleDAVClientfetchCalendarObjectsStub.called).true;
            expect(tsdavModuleGetBasicAuthHeadersStub.called).true;
            expect(appleConverterServiceStub.convertCalDAVCalendarToAppleCalendarIntegration.called).true;
            expect(appleConverterServiceStub.convertCalDAVCalendarObjectsToAppleCalDAVIntegrationSchedules.called).true;
            expect(appleCalDAVIntegrationRepositoryStub.save.called).true;
        });

        it('should be threw a AlreadyIntegratedCalendar', async () => {

            const userSettingMock = stubOne(UserSetting);
            const userMock = stubOne(User, {
                userSetting: userSettingMock
            });
            const appleCalDAVCredentialMock = testMockUtil.getAppleCalDavCredentialMock();
            const timezoneMock = 'Asia/Seoul';

            const appleCalDavCalendarIntegrationStubs = stub(AppleCalDAVCalendarIntegration);
            const appleCalDavIntegrationStub = stubOne(AppleCalDAVIntegration, {
                appleCalDAVCalendarIntegrations: appleCalDavCalendarIntegrationStubs
            });

            appleCalDAVIntegrationRepositoryStub.save.resolves(appleCalDavIntegrationStub);
            appleCalDAVIntegrationRepositoryStub.findOneBy.resolves(appleCalDavIntegrationStub);

            await expect(service.create(
                userMock,
                userSettingMock,
                appleCalDAVCredentialMock,
                timezoneMock
            )).rejectedWith(AlreadyIntegratedCalendar);
        });
    });

    it('should be removed a Apple Cal DAV Integration', async () => {

        const vendorIntegrationIdMock = 1;
        const userIdMock = 2;
        const deleteResultStub = TestMockUtil.getTypeormDeleteResultMock();

        appleCalDAVIntegrationRepositoryStub.delete.resolves(deleteResultStub);

        const deleteResult = await service.remove(vendorIntegrationIdMock, userIdMock);

        expect(deleteResult).true;
        expect(appleCalDAVIntegrationRepositoryStub.delete.called).true;
    });
});
