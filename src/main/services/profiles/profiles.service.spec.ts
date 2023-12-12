import { Test, TestingModule } from '@nestjs/testing';
import { FindOptionsWhere, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Profile } from '@entity/profiles/profile.entity';
import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
    let service: ProfilesService;

    let profileRepositoryStub: sinon.SinonStubbedInstance<Repository<Profile>>;

    beforeEach(async () => {

        profileRepositoryStub = sinon.createStubInstance<Repository<Profile>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ProfilesService,
                {
                    provide: getRepositoryToken(Profile),
                    useValue: profileRepositoryStub
                }
            ]
        }).compile();

        service = module.get<ProfilesService>(ProfilesService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test profile fetching', () => {

        it('should be found profile by profile id', async () => {
            const profileStub = stubOne(Profile);

            profileRepositoryStub.findOneOrFail.resolves(profileStub);

            const loadedUser =  await firstValueFrom(service.findProfileById(profileStub.id));

            const actualPassedParam = profileRepositoryStub.findOneOrFail.getCall(0).args[0];
            expect((actualPassedParam.where as FindOptionsWhere<Profile>).id).equals(profileStub.id);

            expect(loadedUser).equal(profileStub);
        });
    });
});
