import { Test, TestingModule } from '@nestjs/testing';
import { KakaotalkFetchOAuth2UserProfileService as KakaotalkFetchOAuth2UserProfileService } from './kakaotalk-fetch-oauth2-user-profile.service';

describe('KakaotalkFetchOAuth2UserProfileService', () => {
    let service: KakaotalkFetchOAuth2UserProfileService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [KakaotalkFetchOAuth2UserProfileService]
        }).compile();

        service = module.get<KakaotalkFetchOAuth2UserProfileService>(KakaotalkFetchOAuth2UserProfileService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
