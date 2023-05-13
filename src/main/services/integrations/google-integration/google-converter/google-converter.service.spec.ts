import { Test, TestingModule } from '@nestjs/testing';
import { TestMockUtil } from '@test/test-mock-util';
import { GoogleConverterService } from './google-converter.service';

const testMockUtil = new TestMockUtil();

describe('GoogleConverterService', () => {
    let service: GoogleConverterService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleConverterService]
        }).compile();

        service = module.get<GoogleConverterService>(GoogleConverterService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be converted to GoogleCalendarIntegration from GoogleCalendar', () => {
        const googleCalendarListMock = testMockUtil.getGoogleCalendarMock();

        const googleCalendarList =
            service.convertToGoogleCalendarIntegration(googleCalendarListMock);

        expect(googleCalendarList).ok;
        expect(googleCalendarList.length).greaterThan(0);

        const [converted] = googleCalendarList;
        expect(converted).ok;
        expect(converted.primary).ok;
    });
});
