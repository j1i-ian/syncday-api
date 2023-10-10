import { Test, TestingModule } from '@nestjs/testing';
import { ContactType } from '@interfaces/events/contact-type.enum';
import { IntegrationVendor } from '@interfaces/integrations/integration-vendor.enum';
import { ZoomIntegrationFacade } from '@services/integrations/zoom-integrations/zoom-integrations.facade';
import { ZoomIntegration } from '@entity/integrations/zoom/zoom-integration.entity';
import { Contact } from '@entity/events/contact.entity';
import { Schedule } from '@entity/schedules/schedule.entity';
import { ConferenceLink } from '@entity/schedules/conference-link.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { ZoomConferenceLinkIntegrationsService } from './zoom-conference-link-integrations.service';

const testMockUtil = new TestMockUtil();

describe('ZoomConferenceLinkIntegrationsService', () => {
    let service: ZoomConferenceLinkIntegrationsService;

    let zoomIntegrationFacadeStub: sinon.SinonStubbedInstance<ZoomIntegrationFacade>;

    before(async () => {

        zoomIntegrationFacadeStub = sinon.createStubInstance(ZoomIntegrationFacade);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ZoomConferenceLinkIntegrationsService,
                {
                    provide: ZoomIntegrationFacade,
                    useValue: zoomIntegrationFacadeStub
                }
            ]
        }).compile();

        service = module.get<ZoomConferenceLinkIntegrationsService>(ZoomConferenceLinkIntegrationsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test createMeeting', () => {

        let serviceSandbox: sinon.SinonSandbox;

        const fakeConferenceLink: ConferenceLink = {
            link: 'fakeConferenceLink',
            type: IntegrationVendor.ZOOM,
            serviceName: 'Zoom'
        };

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            serviceSandbox.stub(service, 'getConferenceLinkFromVendorCalendarEvent').returns(fakeConferenceLink);

            const oauthTokenStub = testMockUtil.getOAuthTokenMock();

            const zoomCreateMeetingResponseDTOStub = testMockUtil.getZoomCreateMeetingResponseDTOMock();

            zoomIntegrationFacadeStub.issueTokenByRefreshToken.resolves(oauthTokenStub);

            zoomIntegrationFacadeStub.createMeeting.resolves(zoomCreateMeetingResponseDTOStub);
        });

        afterEach(() => {
            zoomIntegrationFacadeStub.issueTokenByRefreshToken.reset();
            zoomIntegrationFacadeStub.createMeeting.reset();
            serviceSandbox.restore();
        });

        [
            {
                description: 'should be generated meeting link when a Zoom contact is provided to the method',
                getContactMocks: () => {
                    const contactMocks = stub(Contact, 4);
                    contactMocks[0].type = ContactType.ZOOM;

                    return contactMocks;
                },
                expectedConferenceLink: fakeConferenceLink
            },
            {
                description: 'should be not generated meeting link when a Zoom contact is not provided to the method',
                getContactMocks: () => {
                    const contactMocks = stub(Contact, 1, {
                        type: ContactType.IN_PERSON
                    });

                    return contactMocks;
                },
                expectedConferenceLink: null
            }
        ].forEach(function({
            description,
            getContactMocks,
            expectedConferenceLink
        }) {
            it(description, async () => {

                const zoomIntegrationMock = stubOne(ZoomIntegration);
                const contactMocks = getContactMocks();
                const scheduleMock = stubOne(Schedule, {
                    scheduledTime: {
                        startTimestamp: new Date(),
                        endTimestamp: new Date()
                    }
                });
                const timezoneMock = 'Asia/Seoul';

                const confereceLink = await service.createMeeting(
                    zoomIntegrationMock,
                    contactMocks,
                    scheduleMock,
                    timezoneMock
                );

                expect(confereceLink).equals(expectedConferenceLink);
            });

        });

    });
});