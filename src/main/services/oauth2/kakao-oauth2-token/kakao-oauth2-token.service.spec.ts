import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserService } from '@services/users/user.service';
import { KakaotalkIntegrationsFacade } from '@services/integrations/kakaotalk-integrations/kakaotalk-integrations.facade';
import { KakaoOAuth2TokenService as KakaoOAuth2TokenService } from './kakao-oauth2-token.service';

describe('KakaoOAuth2TokenService', () => {
    let service: KakaoOAuth2TokenService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let userServiceStub: sinon.SinonStubbedInstance<UserService>;
    let kakaotalkIntegrationFacadeStub: sinon.SinonStubbedInstance<KakaotalkIntegrationsFacade>;

    before(async () => {

        configServiceStub = sinon.createStubInstance(ConfigService);
        userServiceStub = sinon.createStubInstance(UserService);
        kakaotalkIntegrationFacadeStub = sinon.createStubInstance(KakaotalkIntegrationsFacade);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                KakaoOAuth2TokenService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: UserService,
                    useValue: userServiceStub
                },
                {
                    provide: KakaotalkIntegrationsFacade,
                    useValue: kakaotalkIntegrationFacadeStub
                }
            ]
        }).compile();

        service = module.get<KakaoOAuth2TokenService>(KakaoOAuth2TokenService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
