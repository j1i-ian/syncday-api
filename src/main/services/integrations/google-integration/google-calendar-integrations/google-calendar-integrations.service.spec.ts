import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { GoogleCalendarIntegration } from '@entity/integrations/google/google-calendar-integration.entity';
import { User } from '@entity/users/user.entity';
import { NotAnOwnerException } from '@app/exceptions/not-an-owner.exception';
import { GoogleCalendarIntegrationsService } from './google-calendar-integrations.service';

describe('GoogleCalendarIntegrationsService', () => {
    let service: GoogleCalendarIntegrationsService;

    let gogoleCalendarIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleCalendarIntegration>>;

    before(async () => {
        gogoleCalendarIntegrationRepositoryStub =
            sinon.createStubInstance<Repository<GoogleCalendarIntegration>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleCalendarIntegrationsService,
                {
                    provide: getRepositoryToken(GoogleCalendarIntegration),
                    useValue: gogoleCalendarIntegrationRepositoryStub
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
            gogoleCalendarIntegrationRepositoryStub.find.reset();
            gogoleCalendarIntegrationRepositoryStub.save.reset();
        });

        it('should be searched for calendar items', async () => {
            const userStub = stubOne(User);
            const calendarStubs = stub(GoogleCalendarIntegration);

            gogoleCalendarIntegrationRepositoryStub.find.resolves(calendarStubs as any);

            const calendars = await firstValueFrom(
                service.search({
                    userId: userStub.id
                })
            );

            expect(calendars).ok;
            expect(calendars.length).greaterThan(0);
            expect(gogoleCalendarIntegrationRepositoryStub.find.called).true;
        });

        it('should be patched for calendar items', async () => {
            const userStub = stubOne(User);
            const calendarStubs = stub(GoogleCalendarIntegration);

            gogoleCalendarIntegrationRepositoryStub.find.resolves(calendarStubs as any);
            gogoleCalendarIntegrationRepositoryStub.save.resolves(calendarStubs as any);

            const patchSuccess = await service.patch(userStub.id, calendarStubs);

            expect(patchSuccess).true;
            expect(gogoleCalendarIntegrationRepositoryStub.find.called).true;
            expect(gogoleCalendarIntegrationRepositoryStub.save.called).true;
        });

        it('should be threw error when there is calendar in request array that is not owned of user', async () => {
            const userStub = stubOne(User);
            const calendarStubs = stub(GoogleCalendarIntegration);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const [_first, ...rest] = calendarStubs;

            gogoleCalendarIntegrationRepositoryStub.find.resolves(rest as any);

            await expect(service.patch(userStub.id, calendarStubs)).rejectedWith(
                NotAnOwnerException
            );

            expect(gogoleCalendarIntegrationRepositoryStub.find.called).true;
            expect(gogoleCalendarIntegrationRepositoryStub.save.called).false;
        });
    });
});
