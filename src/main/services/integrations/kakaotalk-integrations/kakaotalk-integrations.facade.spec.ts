import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KakaotalkIssueOAuth2TokenService } from '@services/integrations/kakaotalk-integrations/facades/kakaotalk-issue-oauth2-token.service';
import { KakaotalkFetchOAuth2UserProfileService } from '@services/integrations/kakaotalk-integrations/facades/kakaotalk-fetch-oauth2-user-profile.service';
import { KakaotalkIntegrationsFacade } from './kakaotalk-integrations.facade';

describe('KakaotalkIntegrationsFacade', () => {
    let service: KakaotalkIntegrationsFacade;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let kakaotalkIssueOAuth2TokenServiceStub: sinon.SinonStubbedInstance<KakaotalkIssueOAuth2TokenService>;
    let kakaotalkFetchOAuth2UserProfileServiceStub: sinon.SinonStubbedInstance<KakaotalkFetchOAuth2UserProfileService>;

    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                KakaotalkIntegrationsFacade,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: KakaotalkIssueOAuth2TokenService,
                    useValue: kakaotalkIssueOAuth2TokenServiceStub
                },
                {
                    provide: KakaotalkFetchOAuth2UserProfileService,
                    useValue: kakaotalkFetchOAuth2UserProfileServiceStub
                }
            ]
        }).compile();

        service = module.get<KakaotalkIntegrationsFacade>(KakaotalkIntegrationsFacade);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
