import { Test, TestingModule } from '@nestjs/testing';
import * as tsdavModule from 'tsdav';
import { TestMockUtil } from '@test/test-mock-util';
import { AppleCalendarEventListService } from './apple-calendar-event-list.service';

const testMockUtil = new TestMockUtil();

describe('AppleCalendarEventListService', () => {
    let service: AppleCalendarEventListService;

    let tsdavModuleStub: sinon.SinonStub;
    let tsdavModuleGetBasicAuthHeadersStub: sinon.SinonStub;

    before(async () => {

        tsdavModuleStub = sinon.stub(tsdavModule, 'default');
        tsdavModuleGetBasicAuthHeadersStub = sinon.stub(tsdavModule, 'getBasicAuthHeaders');
        tsdavModuleGetBasicAuthHeadersStub.returns({});

        const module: TestingModule = await Test.createTestingModule({
            providers: [AppleCalendarEventListService]
        }).compile();

        service = module.get<AppleCalendarEventListService>(AppleCalendarEventListService);
    });

    afterEach(() => {
        tsdavModuleGetBasicAuthHeadersStub.reset();
    });

    after(() => {
        tsdavModuleStub.reset();
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be searched schedules', async () => {

        const calDAVCalendarObjectStubs = testMockUtil.getCalDavObjectMocks();

        const davClientMock = testMockUtil.getCalDavClientMock({
            calendars: [],
            calendarObjects: calDAVCalendarObjectStubs
        });

        const davUrlMock = '';
        const untilDateMock = new Date();

        const searchedSchedules = await service.search(
            davClientMock,
            davUrlMock,
            untilDateMock
        );

        expect(searchedSchedules).ok;

        expect(tsdavModuleGetBasicAuthHeadersStub.called).true;
    });
});
