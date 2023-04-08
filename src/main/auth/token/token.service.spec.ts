import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../../@core/core/entities/users/user.entity';
import { GoogleIntegrationsService } from '../../services/integrations/google-integrations.service';
import { UserService } from '../../services/users/user.service';
import { IntegrationUtilService } from '../../services/util/integration-util/integraion-util.service';
import { TokenService } from './token.service';

describe('TokenService', () => {
    let service: TokenService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let jwtServiceStub: sinon.SinonStubbedInstance<JwtService>;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let googleIntegrationServiceStub: sinon.SinonStubbedInstance<GoogleIntegrationsService>;
    let integrationUtilServiceStub: sinon.SinonStubbedInstance<IntegrationUtilService>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        jwtServiceStub = sinon.createStubInstance(JwtService);
        userServiceStub = sinon.createStubInstance(UserService);
        googleIntegrationServiceStub = sinon.createStubInstance(GoogleIntegrationsService);
        integrationUtilServiceStub = sinon.createStubInstance(IntegrationUtilService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TokenService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: JwtService,
                    useValue: jwtServiceStub
                },
                {
                    provide: UserService,
                    useValue: userServiceStub
                },
                {
                    provide: GoogleIntegrationsService,
                    useValue: googleIntegrationServiceStub
                },
                {
                    provide: IntegrationUtilService,
                    useValue: integrationUtilServiceStub
                }
            ]
        }).compile();

        service = module.get<TokenService>(TokenService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be issued token', () => {
        const userMock = stubOne(User);
        const fakeTokenStub = 'iamfaketoken';

        jwtServiceStub.sign.returns(fakeTokenStub);

        const signed = service.issueToken(userMock);

        expect(signed).ok;
        expect(signed.accessToken).equal(fakeTokenStub);
        expect(service).ok;
    });
});
