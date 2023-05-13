import { Test, TestingModule } from '@nestjs/testing';
import { GoogleOAuthClientService } from './google-oauth-client.service';

describe('GoogleOauthClientService', () => {
    let service: GoogleOAuthClientService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleOAuthClientService]
        }).compile();

        service = await module.resolve<GoogleOAuthClientService>(GoogleOAuthClientService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
