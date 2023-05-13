import { Test, TestingModule } from '@nestjs/testing';
import { GoogleOAuthUserService } from './google-oauth-user.service';

describe('GoogleOAuthUser', () => {
    let service: GoogleOAuthUserService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GoogleOAuthUserService]
        }).compile();

        service = await module.resolve<GoogleOAuthUserService>(GoogleOAuthUserService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
