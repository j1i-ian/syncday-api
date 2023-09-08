import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ZoomIntegrationsService } from '@services/integrations/zoom-integrations/zoom-integrations.service';
import { User } from '@entity/users/user.entity';
import { ZoomIntegration } from '@entity/integrations/zoom/zoom-integration.entity';

describe('ZoomIntegrationsService', () => {
    let service: ZoomIntegrationsService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let jwtServiceStub: sinon.SinonStubbedInstance<JwtService>;

    let zoomIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<ZoomIntegration>>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        jwtServiceStub = sinon.createStubInstance(JwtService);

        zoomIntegrationRepositoryStub = sinon.createStubInstance<Repository<ZoomIntegration>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
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
                    provide: getRepositoryToken(ZoomIntegration),
                    useValue: zoomIntegrationRepositoryStub
                }
            ]
        }).compile();

        service = module.get<ZoomIntegrationsService>(ZoomIntegrationsService);
    });

    afterEach(() => {
        zoomIntegrationRepositoryStub.find.reset();
        zoomIntegrationRepositoryStub.findOne.reset();
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
});
