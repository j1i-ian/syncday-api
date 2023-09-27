import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ZoomIntegrationsService } from '@services/integrations/zoom-integrations/zoom-integrations.service';
import { User } from '@entity/users/user.entity';
import { ZoomIntegration } from '@entity/integrations/zoom/zoom-integration.entity';
import { Event } from '@entity/events/event.entity';
import { TestMockUtil } from '@test/test-mock-util';

describe('ZoomIntegrationsService', () => {
    let service: ZoomIntegrationsService;

    let module: TestingModule;
    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let jwtServiceStub: sinon.SinonStubbedInstance<JwtService>;

    let eventRepositoryStub: sinon.SinonStubbedInstance<Repository<Event>>;
    let zoomIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<ZoomIntegration>>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        jwtServiceStub = sinon.createStubInstance(JwtService);

        eventRepositoryStub = sinon.createStubInstance<Repository<Event>>(Repository);
        zoomIntegrationRepositoryStub = sinon.createStubInstance<Repository<ZoomIntegration>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                ZoomIntegrationsService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: JwtService,
                    useValue: jwtServiceStub
                },
                {
                    provide: getRepositoryToken(Event),
                    useValue: eventRepositoryStub
                },
                {
                    provide: getRepositoryToken(ZoomIntegration),
                    useValue: zoomIntegrationRepositoryStub
                },
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                }
            ]
        }).compile();

        service = module.get<ZoomIntegrationsService>(ZoomIntegrationsService);
    });

    afterEach(() => {
        eventRepositoryStub.find.reset();
        eventRepositoryStub.update.reset();

        zoomIntegrationRepositoryStub.find.reset();
        zoomIntegrationRepositoryStub.findOne.reset();
        zoomIntegrationRepositoryStub.findOneOrFail.reset();
        zoomIntegrationRepositoryStub.delete.reset();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be searched for zoom integrations', async () => {

        const userIdMock = stubOne(User).id;
        const zoomIntegrations = stub(ZoomIntegration);

        zoomIntegrationRepositoryStub.find.resolves(zoomIntegrations);

        const searchedZoomIntegrations = await service.search({
            userId: userIdMock
        });

        expect(searchedZoomIntegrations).ok;
        expect(searchedZoomIntegrations.length).greaterThan(0);

        const parsedZoomIntegration = searchedZoomIntegrations[0];
        expect(parsedZoomIntegration).ok;
        expect(parsedZoomIntegration.email).ok;
        expect((parsedZoomIntegration as ZoomIntegration).accessToken).not.ok;

        expect(zoomIntegrationRepositoryStub.find.called).true;
    });

    it('should be got zoom integration with findOne', async () => {

        const userMock = stubOne(User);
        const zoomIntegrationStub = stubOne(ZoomIntegration);

        zoomIntegrationRepositoryStub.findOne.resolves(zoomIntegrationStub);

        const loadedZoomIntegration: ZoomIntegration = await service.findOne({
            userId: userMock.id
        }) as ZoomIntegration;

        expect(loadedZoomIntegration).ok;
        expect(loadedZoomIntegration.id).equals(zoomIntegrationStub.id);
        expect(zoomIntegrationRepositoryStub.findOne.called).true;
    });

    it('should be removed zoom integration with disabling related events', async () => {

        const userMock = stubOne(User);
        const zoomIntegrationStub = stubOne(ZoomIntegration);
        const zoomIntegrationDeleteResultStub = TestMockUtil.getTypeormDeleteResultMock();
        const eventUpdateResultStub = TestMockUtil.getTypeormUpdateResultMock();

        zoomIntegrationRepositoryStub.findOneOrFail.resolves(zoomIntegrationStub);
        eventRepositoryStub.find.resolves([]);

        zoomIntegrationRepositoryStub.delete.resolves(zoomIntegrationDeleteResultStub);
        eventRepositoryStub.update.resolves(eventUpdateResultStub);

        const deleteSuccess: boolean = await service.remove(
            zoomIntegrationStub.id,
            userMock.id
        );

        expect(zoomIntegrationRepositoryStub.findOneOrFail.called).true;
        expect(zoomIntegrationRepositoryStub.delete.called).true;
        expect(eventRepositoryStub.find.called).true;
        expect(eventRepositoryStub.update.called).false;

        expect(deleteSuccess).true;
    });
});
