import { Test, TestingModule } from '@nestjs/testing';
import * as tsdavModule from 'tsdav';
import { TestMockUtil } from '@test/test-mock-util';
import { AppleCalendarListService } from './apple-calendar-list.service';

const testMockUtil = new TestMockUtil();

describe('AppleCalendarListService', () => {
    let service: AppleCalendarListService;

    let tsdavModuleStub: sinon.SinonStub;

    before(async () => {

        tsdavModuleStub = sinon.stub(tsdavModule, 'default');

        const module: TestingModule = await Test.createTestingModule({
            providers: [AppleCalendarListService]
        }).compile();

        service = module.get<AppleCalendarListService>(AppleCalendarListService);
    });

    after(() => {
        tsdavModuleStub.reset();
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be searched calendars with filtering for VEVENT', async () => {

        const calDAVCalendarStubs = testMockUtil.getCalDavCalendarMocks();

        const davClientMock = testMockUtil.getCalDavClientMock({
            calendars: calDAVCalendarStubs as any[],
            calendarObjects: []
        });

        const calendars = await service.search(davClientMock);
        expect(calendars).ok;
        expect(calendars.length).greaterThan(0);
        expect(calendars.length).not.eq(calDAVCalendarStubs.length);
    });
});
