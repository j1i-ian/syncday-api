import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { GoogleCalendarIntegrationsService } from './google-calendar-integrations.service';

describe('GoogleCalendarIntegrationsService', () => {
    let service: GoogleCalendarIntegrationsService;

    let googleCalendarIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleCalendarIntegration>>;
    let googleIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegration>>;

    before(async () => {
        googleCalendarIntegrationRepositoryStub =
            sinon.createStubInstance<Repository<GoogleCalendarIntegration>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleCalendarIntegrationsService,
                {
                    provide: getRepositoryToken(GoogleCalendarIntegration),
                    useValue: googleCalendarIntegrationRepositoryStub
                },
                {
                    provide: getRepositoryToken(GoogleIntegration),
                    useValue: googleIntegrationRepositoryStub
                }
            ]
        }).compile();

        service = module.get<GoogleCalendarIntegrationsService>(GoogleCalendarIntegrationsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test CRUD for google calendar integration', () => {
        afterEach(() => {
            googleCalendarIntegrationRepositoryStub.find.reset();
            googleCalendarIntegrationRepositoryStub.save.reset();
        });

        it('should be searched for calendar items', async () => {
            const userStub = stubOne(User);
            const calendarStubs = stub(GoogleCalendarIntegration);

            googleCalendarIntegrationRepositoryStub.find.resolves(calendarStubs as any);

            const calendars = await firstValueFrom(
                service.search({
                    userId: userStub.id
                })
            );

            expect(calendars).ok;
            expect(calendars.length).greaterThan(0);
            expect(googleCalendarIntegrationRepositoryStub.find.called).true;
        });

        it('should be patched for calendar items', async () => {
            const userStub = stubOne(User);
            const calendarStubs = stub(GoogleCalendarIntegration, 5, {
                setting: {
                    conflictCheck: false,
                    outboundWriteSync: true,
                    inboundDecliningSync: false
                }
            });

            const googleCalendarIntegrationsMock = calendarStubs[0];

            googleCalendarIntegrationRepositoryStub.find.resolves(calendarStubs as any);
            googleCalendarIntegrationRepositoryStub.save.resolves([calendarStubs[0]] as any);

            const patchSuccess = await service.patch(userStub.id, [googleCalendarIntegrationsMock]);

            expect(patchSuccess).true;
            expect(googleCalendarIntegrationRepositoryStub.find.called).true;
            expect(googleCalendarIntegrationRepositoryStub.save.called).true;
        });

        it('should be threw error when there is calendar in request array that is not owned of user', async () => {
            const userStub = stubOne(User);
            const calendarStubs = stub(GoogleCalendarIntegration, 1, {
                setting: {
                    conflictCheck: false,
                    outboundWriteSync: true,
                    inboundDecliningSync: false
                }
            });

            const googleCalendarIntegrationsMock = calendarStubs[0];

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [_first, ...rest] = calendarStubs;

            googleCalendarIntegrationRepositoryStub.find.resolves(rest as any);

            await expect(service.patch(userStub.id,  [googleCalendarIntegrationsMock])).rejectedWith(
                NotAnOwnerException
            );

            expect(googleCalendarIntegrationRepositoryStub.find.called).true;
            expect(googleCalendarIntegrationRepositoryStub.save.called).false;
        });
    });
});
