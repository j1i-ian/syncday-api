import { Test, TestingModule } from '@nestjs/testing';

import { Logger } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { AppleCalendarListService } from '@services/integrations/apple-integrations/facades/apple-calendar-list.service';
import { AppleCalendarEventListService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-list.service';
import { AppleCaldavClientService } from '@services/integrations/apple-integrations/facades/apple-caldav-client.service';
import { AppleConverterService } from '@services/integrations/apple-integrations/apple-converter/apple-converter.service';
import { AppleCalendarEventCreateService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-create.service';
import { AppleCalendarEventPatchService } from '@services/integrations/apple-integrations/facades/apple-calendar-event-patch.service';
import { TestMockUtil } from '@test/test-mock-util';
import { AppleIntegrationFacadeService } from './apple-integration-facade.service';

const testMockUtil = new TestMockUtil();

describe('AppleIntegrationFacadeService', () => {
    let service: AppleIntegrationFacadeService;

    let loggerStub: sinon.SinonStubbedInstance<Logger>;

    let appleConverterServiceStub: sinon.SinonStubbedInstance<AppleConverterService>;
    let appleCaldavClientServiceStub: sinon.SinonStubbedInstance<AppleCaldavClientService>;
    let appleCalendarListServiceStub: sinon.SinonStubbedInstance<AppleCalendarListService>;
    let appleCalendarEventListServiceStub: sinon.SinonStubbedInstance<AppleCalendarEventListService>;
    let appleCalendarEventCreateServiceStub: sinon.SinonStubbedInstance<AppleCalendarEventCreateService>;
    let appleCalendarEventPatchServiceStub: sinon.SinonStubbedInstance<AppleCalendarEventPatchService>;

    before(async () => {
        loggerStub = sinon.createStubInstance(Logger);

        appleConverterServiceStub = sinon.createStubInstance<AppleConverterService>(AppleConverterService);
        appleCaldavClientServiceStub = sinon.createStubInstance<AppleCaldavClientService>(AppleCaldavClientService);
        appleCalendarListServiceStub = sinon.createStubInstance<AppleCalendarListService>(AppleCalendarListService);
        appleCalendarEventListServiceStub = sinon.createStubInstance<AppleCalendarEventListService>(AppleCalendarEventListService);
        appleCalendarEventCreateServiceStub = sinon.createStubInstance<AppleCalendarEventCreateService>(AppleCalendarEventCreateService);
        appleCalendarEventPatchServiceStub = sinon.createStubInstance<AppleCalendarEventPatchService>(AppleCalendarEventPatchService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppleIntegrationFacadeService,
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
                },
                {
                    provide: AppleConverterService,
                    useValue: appleConverterServiceStub
                },
                {
                    provide: AppleCaldavClientService,
                    useValue: appleCaldavClientServiceStub
                },
                {
                    provide: AppleCalendarListService,
                    useValue: appleCalendarListServiceStub
                },
                {
                    provide: AppleCalendarEventListService,
                    useValue: appleCalendarEventListServiceStub
                },
                {
                    provide: AppleCalendarEventCreateService,
                    useValue: appleCalendarEventCreateServiceStub
                },
                {
                    provide: AppleCalendarEventPatchService,
                    useValue: appleCalendarEventPatchServiceStub
                }
            ]
        }).compile();

        service = module.get<AppleIntegrationFacadeService>(AppleIntegrationFacadeService);
    });

    after(() => {
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test CalDAV client service', () => {

        afterEach(() => {
            appleCaldavClientServiceStub.generateCalDAVClient.reset();
        });

        it('should be generated for cal dav client', async () => {

            const appleCredentialMock = testMockUtil.getAppleCalDAVCredentialMock();

            const davClientStub = testMockUtil.getCalDavClientMock();

            appleCaldavClientServiceStub.generateCalDAVClient.resolves(davClientStub);

            const generatedClient = await service.generateCalDAVClient(appleCredentialMock);

            expect(generatedClient).ok;
            expect(appleCaldavClientServiceStub.generateCalDAVClient.called).true;
        });
    });

    describe('Test Calendar Search', () => {

        afterEach(() => {
            appleCalendarListServiceStub.search.reset();
        });

        it('should be searched for calendars', async () => {

            const davClientMock = testMockUtil.getCalDavClientMock();
            const davCalendarStubs = testMockUtil.getCalDavCalendarMocks();

            appleCalendarListServiceStub.search.resolves(davCalendarStubs);

            const searchedCalendars = await service.searchCalendars(davClientMock);

            expect(searchedCalendars).ok;
            expect(searchedCalendars.length).greaterThan(0);
            expect(appleCalendarListServiceStub.search.called).true;
        });
    });

    describe('Test Schedules Search', () => {

        afterEach(() => {
            appleCalendarEventListServiceStub.search.reset();
        });

        it('should be searched for schedules', async () => {

            const davClientMock = testMockUtil.getCalDavClientMock();
            const davCalendarObjectStubs = testMockUtil.getCalDavObjectMocks();
            const calendarDAVUrlMock = '';

            appleCalendarEventListServiceStub.search.resolves(davCalendarObjectStubs);

            const searchedCalendars = await service.searchSchedules(
                davClientMock,
                calendarDAVUrlMock
            );

            expect(searchedCalendars).ok;
            expect(searchedCalendars.length).greaterThan(0);
            expect(appleCalendarEventListServiceStub.search.called).true;
        });

        it('should be searched for schedules up to 3 months in the future defaultly', async () => {

            const davClientMock = testMockUtil.getCalDavClientMock();
            const davCalendarObjectStubs = testMockUtil.getCalDavObjectMocks();
            const calendarDAVUrlMock = '';

            appleCalendarEventListServiceStub.search.resolves(davCalendarObjectStubs);

            const searchedSchedules = await service.searchSchedules(
                davClientMock,
                calendarDAVUrlMock
            );

            expect(searchedSchedules).ok;
            expect(searchedSchedules.length).greaterThan(0);

            expect(appleCalendarEventListServiceStub.search.called).true;

            const defalutUntilDate = appleCalendarEventListServiceStub.search.getCall(0).args[2];
            expect(defalutUntilDate).ok;
            expect(defalutUntilDate.getTime()).greaterThan(Date.now());
        });

        it('should be searched for schedules up to user-specific months', async () => {

            const davClientMock = testMockUtil.getCalDavClientMock();
            const davCalendarObjectStubs = testMockUtil.getCalDavObjectMocks();
            const calendarDAVUrlMock = '';
            const today = new Date();

            appleCalendarEventListServiceStub.search.resolves(davCalendarObjectStubs);

            const searchedSchedules = await service.searchSchedules(
                davClientMock,
                calendarDAVUrlMock,
                today
            );

            expect(searchedSchedules).ok;
            expect(searchedSchedules.length).greaterThan(0);

            expect(appleCalendarEventListServiceStub.search.called).true;

            const untilToday = appleCalendarEventListServiceStub.search.getCall(0).args[2];
            expect(untilToday).ok;

        });
    });

});
