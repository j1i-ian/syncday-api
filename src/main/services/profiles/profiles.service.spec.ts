import { Test, TestingModule } from '@nestjs/testing';
import { FindOptionsWhere, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { Profile } from '@entity/profiles/profile.entity';
import { Team } from '@entity/teams/team.entity';
import { TestMockUtil } from '@test/test-mock-util';
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

        afterEach(() => {
            profileRepositoryStub.findOneOrFail.reset();
            profileRepositoryStub.find.reset();
        });

        it('should be searched profiles by team id', async () => {
            const teamIdMock = stubOne(Team).id;
            const profileStubs = stub(Profile);

            profileRepositoryStub.find.resolves(profileStubs);

            const loadedProfiles =  await firstValueFrom(service.searchByTeamId(teamIdMock));

            expect(loadedProfiles).ok;
            expect(loadedProfiles.length).greaterThan(0);
            expect(profileRepositoryStub.find.called).true;
        });

        it('should be found profile by profile id', async () => {
            const profileStub = stubOne(Profile);

            profileRepositoryStub.findOneOrFail.resolves(profileStub);

            const loadedUser =  await firstValueFrom(service.findProfileById(profileStub.id));

            const actualPassedParam = profileRepositoryStub.findOneOrFail.getCall(0).args[0];
            expect((actualPassedParam.where as FindOptionsWhere<Profile>).id).equals(profileStub.id);

            expect(loadedUser).equal(profileStub);
        });
    });

    it('should be patched for profile', async () => {
        const profileIdMock = 123;

        const profileMock = stubOne(Profile);

        const updateResultStub = TestMockUtil.getTypeormUpdateResultMock();

        profileRepositoryStub.update.resolves(updateResultStub);

        const updateResult = await firstValueFrom(service.patch(profileIdMock, profileMock));
        expect(updateResult).ok;
        expect(profileRepositoryStub.update.called).true;
    });
});
