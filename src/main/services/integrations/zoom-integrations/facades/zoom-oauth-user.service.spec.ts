import { Test, TestingModule } from '@nestjs/testing';
import { ZoomOauthUserService } from './zoom-oauth-user.service';

describe('ZoomOauthUserService', () => {
    let service: ZoomOauthUserService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ZoomOauthUserService]
        }).compile();

        service = module.get<ZoomOauthUserService>(ZoomOauthUserService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
