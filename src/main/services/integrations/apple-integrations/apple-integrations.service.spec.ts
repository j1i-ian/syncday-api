import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppleConverterService } from '@services/integrations/apple-integrations/apple-converter/apple-converter.service';
import { AppleIntegrationsSchedulesService } from '@services/integrations/apple-integrations/apple-integrations-schedules/apple-integrations-schedules.service';
import { AppleIntegrationFacadeService } from '@services/integrations/apple-integrations/apple-integration-facade.service';
import { AppleCalendarIntegrationsService } from '@services/integrations/apple-integrations/apple-calendar-integrations/apple-calendar-integrations.service';
import { AppleCalDAVIntegration } from '@entity/integrations/apple/apple-caldav-integration.entity';

import { User } from '@entity/users/user.entity';
import { AppleCalDAVCalendarIntegration } from '@entity/integrations/apple/apple-caldav-calendar-integration.entity';
import { UserSetting } from '@entity/users/user-setting.entity';
import { AppleCalDAVIntegrationSchedule } from '@entity/integrations/apple/apple-caldav-integration-schedule.entity';
import { AlreadyIntegratedCalendarException } from '@app/exceptions/integrations/already-integrated-calendar.exception';
import { TestMockUtil } from '@test/test-mock-util';
import { AppleIntegrationsService } from './apple-integrations.service';

const testMockUtil = new TestMockUtil();

describe('AppleIntegrationsService', () => {
    let service: AppleIntegrationsService;

    let appleConverterServiceStub: sinon.SinonStubbedInstance<AppleConverterService>;
    let appleIntegrationsSchedulesServiceStub: sinon.SinonStubbedInstance<AppleIntegrationsSchedulesService>;
    let appleIntegrationFacadeServiceStub: sinon.SinonStubbedInstance<AppleIntegrationFacadeService>;
    let appleCalendarIntegrationServiceStub: sinon.SinonStubbedInstance<AppleCalendarIntegrationsService>;

    let appleCalDAVIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<AppleCalDAVIntegration>>;

    before(async () => {

        appleCalDAVIntegrationRepositoryStub = sinon.createStubInstance<Repository<AppleCalDAVIntegration>>(Repository);

        appleConverterServiceStub = sinon.createStubInstance(AppleConverterService);
        appleIntegrationsSchedulesServiceStub = sinon.createStubInstance(AppleIntegrationsSchedulesService);
        appleIntegrationFacadeServiceStub = sinon.createStubInstance(AppleIntegrationFacadeService);

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
                    provide: AppleIntegrationFacadeService,
                    useValue: appleIntegrationFacadeServiceStub
                },
                {
                    provide: AppleCalendarIntegrationsService,
                    useValue: appleCalendarIntegrationServiceStub
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
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test Count Apple Integration', () => {

        beforeEach(() => {
            appleCalDAVIntegrationRepositoryStub.countBy.resolves(1);
        });

        afterEach(() => {
            appleCalDAVIntegrationRepositoryStub.countBy.reset();
        });

        it('should be counted integration length by condition', async () => {

            const userIdMock = stubOne(User).id;

            const counted = await service.count({
                userId: userIdMock
            });

            expect(counted).greaterThan(0);
        });
    });

    describe('Test to create apple cal dav integration', () => {

        beforeEach(() => {
            appleIntegrationFacadeServiceStub.searchCalendars;
        });

        afterEach(() => {
            appleConverterServiceStub.convertCalDAVCalendarToAppleCalendarIntegration.reset();
            appleIntegrationFacadeServiceStub.searchCalendars.reset();
        });

        it('should be created a Apple cal dav integration', async () => {

            const userSettingMock = stubOne(UserSetting);
            const userMock = stubOne(User, {
                userSetting: userSettingMock
            });
            const appleCalDAVCredentialMock = testMockUtil.getAppleCalDAVCredentialMock();
            const timezoneMock = 'Asia/Seoul';

            const appleCalDavCalendarIntegrationStubs = stub(AppleCalDAVCalendarIntegration);
            const appleCalDavIntegrationStub = stubOne(AppleCalDAVIntegration, {
                appleCalDAVCalendarIntegrations: appleCalDavCalendarIntegrationStubs
            });
            const convertedAppleCalDAVCalndarIntegrationStub = stub(AppleCalDAVCalendarIntegration);
            const appleCalDAVIntegrationScheduleStubs = stub(AppleCalDAVIntegrationSchedule);
            const calDAVCalendarStubs = testMockUtil.getCalDavCalendarMocks();
            const calDAVCalendarObjectStubs = testMockUtil.getCalDavObjectMocks();

            appleCalDAVIntegrationRepositoryStub.save.resolves(appleCalDavIntegrationStub);
            appleCalDAVIntegrationRepositoryStub.findOneBy.resolves(null);
            appleConverterServiceStub.convertCalDAVCalendarToAppleCalendarIntegration.resolves(convertedAppleCalDAVCalndarIntegrationStub);
            appleConverterServiceStub.convertCalDAVCalendarObjectToAppleCalDAVIntegrationSchedules.resolves(appleCalDAVIntegrationScheduleStubs);

            appleIntegrationFacadeServiceStub.searchCalendars.resolves(calDAVCalendarStubs);
            appleIntegrationFacadeServiceStub.searchSchedules.resolves(calDAVCalendarObjectStubs);

            await service.create(
                userMock,
                userSettingMock,
                appleCalDAVCredentialMock,
                timezoneMock
            );

            expect(appleConverterServiceStub.convertCalDAVCalendarToAppleCalendarIntegration.called).true;
            expect(appleConverterServiceStub.convertCalDAVCalendarObjectToAppleCalDAVIntegrationSchedules.called).true;
            expect(appleCalDAVIntegrationRepositoryStub.save.called).true;
            expect(appleIntegrationFacadeServiceStub.searchCalendars.called).true;
            expect(appleIntegrationFacadeServiceStub.searchSchedules.called).true;
        });

        it('should be threw a AlreadyIntegratedCalendar', async () => {

            const userSettingMock = stubOne(UserSetting);
            const userMock = stubOne(User, {
                userSetting: userSettingMock
            });
            const appleCalDAVCredentialMock = testMockUtil.getAppleCalDAVCredentialMock();
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
            )).rejectedWith(AlreadyIntegratedCalendarException);
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
