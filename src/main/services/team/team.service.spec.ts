import { Test, TestingModule } from '@nestjs/testing';
import { FindManyOptions, FindOptionsWhere, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Team } from '@entity/teams/team.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { Profile } from '@entity/profiles/profile.entity';
import { TeamService } from './team.service';

describe('TeamService', () => {
    let service: TeamService;

    let teamRepositoryStub: sinon.SinonStubbedInstance<Repository<Team>>;

    before(async () => {

        teamRepositoryStub = sinon.createStubInstance<Repository<Team>>(Repository);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TeamService,
                {
                    provide: getRepositoryToken(Team),
                    useValue: teamRepositoryStub
                }
            ]
        }).compile();

        service = module.get<TeamService>(TeamService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test team finding', () => {
        afterEach(() => {
            teamRepositoryStub.find.reset();
            teamRepositoryStub.findOneOrFail.reset();
            teamRepositoryStub.findOneBy.reset();
        });

        it('should be searched teams by profile id', async () => {
            const profileStub = stubOne(Profile);
            const teamsStub = stub(Team);

            teamRepositoryStub.find.resolves(teamsStub);

            const loadedTeams = await firstValueFrom(service.searchByProfileId(profileStub.id));

            const actualPassedParam = teamRepositoryStub.find.getCall(0).args[0] as FindManyOptions<Team>;
            expect(
                (
                    (actualPassedParam.where as FindOptionsWhere<Team>)
                        .profiles as FindOptionsWhere<Profile>
                ).id
            ).equals(profileStub.id);

            expect(loadedTeams[0]).equal(teamsStub[0]);
        });

        it('should be got a team by team workspace', async () => {
            const teamStub = stubOne(Team);

            teamRepositoryStub.findOneOrFail.resolves(teamStub);

            const loadedTeam = await firstValueFrom(service.findTeamByWorkspace(teamStub.workspace as string));

            const actualPassedParam = teamRepositoryStub.findOneOrFail.getCall(0).args[0];
            expect(
                (
                    (actualPassedParam.where as FindOptionsWhere<Team>)
                        .teamSetting as FindOptionsWhere<TeamSetting>
                ).workspace
            ).equals(teamStub.workspace);

            expect(loadedTeam).equal(teamStub);
        });
    });
});
