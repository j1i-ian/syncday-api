import { Test, TestingModule } from '@nestjs/testing';
import { KakaotalkIssueOAuth2TokenService } from './kakaotalk-issue-oauth2-token.service';

describe('KakaotalkIssueOAuth2TokenService', () => {
    let service: KakaotalkIssueOAuth2TokenService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [KakaotalkIssueOAuth2TokenService]
        }).compile();

        service = module.get<KakaotalkIssueOAuth2TokenService>(KakaotalkIssueOAuth2TokenService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
