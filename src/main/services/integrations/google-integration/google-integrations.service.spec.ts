import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { GoogleIntegrationsService } from '@services/integrations/google-integration/google-integrations.service';
import { GoogleIntegration } from '@entity/integrations/google/google-integration.entity';

describe('GoogleIntegrationsService', () => {
    let module: TestingModule;
    let service: GoogleIntegrationsService;

    let gogoleIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegration>>;

    const _getRepository = (EntityClass: new () => any) =>
        module.get(getRepositoryToken(EntityClass));

    const datasourceMock = {
        getRepository: _getRepository,
        transaction: (callback: any) => Promise.resolve(callback({ getRepository: _getRepository }))
    };

    before(async () => {
        gogoleIntegrationRepositoryStub =
            sinon.createStubInstance<Repository<GoogleIntegration>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GoogleIntegrationsService,
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(GoogleIntegration),
                    useValue: gogoleIntegrationRepositoryStub
                }
            ]
        }).compile();

        service = module.get<GoogleIntegrationsService>(GoogleIntegrationsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});


