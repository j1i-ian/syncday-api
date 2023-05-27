import { Test, TestingModule } from '@nestjs/testing';
import { GoogleOAuthTokenService } from './google-oauth-token.service';

describe('GoogleOauthTokenService', () => {
    let service: GoogleOAuthTokenService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleOAuthTokenService]
        }).compile();

        service = await module.resolve<GoogleOAuthTokenService>(GoogleOAuthTokenService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
