import { Test, TestingModule } from '@nestjs/testing';
import { Cluster, Pipeline } from 'ioredis';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { firstValueFrom } from 'rxjs';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { ProfilesRedisRepository } from '@services/profiles/profiles.redis-repository';
import { Team } from '@entity/teams/team.entity';
import { User } from '@entity/users/user.entity';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';
import { TestMockUtil } from '@test/test-mock-util';

const testMockUtil = new TestMockUtil();

describe('Profiles Redis Repository Test', () => {
    let service: ProfilesRedisRepository;

    let loggerStub: sinon.SinonStub;

    let clusterStub: sinon.SinonStubbedInstance<Cluster>;
    let syncdayRedisServiceStub: sinon.SinonStubbedInstance<SyncdayRedisService>;

    beforeEach(async () => {
        clusterStub = sinon.createStubInstance(Cluster);
        syncdayRedisServiceStub = sinon.createStubInstance(SyncdayRedisService);

        loggerStub = sinon.stub({
            error: () => { }
        } as unknown as Logger) as unknown as sinon.SinonStub;

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: getClusterToken(DEFAULT_CLUSTER_NAMESPACE),
                    useValue: clusterStub
                },
                {
                    provide: WINSTON_MODULE_PROVIDER,
                    useValue: loggerStub
                },
                {
                    provide: SyncdayRedisService,
                    useValue: syncdayRedisServiceStub
                },
                ProfilesRedisRepository
            ]
        }).compile();

        service = module.get<ProfilesRedisRepository>(ProfilesRedisRepository);
    });

    after(() => {
        sinon.restore();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Profiles Redis Repository', () => {

        let serviceSandbox: sinon.SinonSandbox;
        let pipelineStub: sinon.SinonStubbedInstance<Pipeline>;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();

            pipelineStub = serviceSandbox.createStubInstance(Pipeline);

            clusterStub.pipeline.returns(pipelineStub);
        });

        afterEach(() => {
            syncdayRedisServiceStub.getInvitedNewMemberKey.reset();

            clusterStub.smembers.reset();
            clusterStub.pipeline.reset();

            serviceSandbox.restore();
        });

        it('should be got invited team id list', async () => {

            const teamStubs = stub(Team);
            const teamIdStringStubs = teamStubs.map((_team) => String(_team.id));
            const emailMock = stubOne(User).email;

            clusterStub.smembers.resolves(teamIdStringStubs);

            const loadedTeamIds = await firstValueFrom(service.getInvitedTeamIds(
                emailMock
            ));

            expect(loadedTeamIds).ok;
            expect(loadedTeamIds.length).greaterThan(0);

            expect(clusterStub.smembers.called).true;
        });

        it('should be set invited new team member', async () => {

            const teamIdMock = stubOne(Team).id;
            const invitedNewMemberMocks = testMockUtil.getInvitedNewTeamMemberMocks(teamIdMock);

            syncdayRedisServiceStub.getInvitedNewMemberKey.returnsArg(0);
            pipelineStub.exec.resolves([]);

            const saveSuccess = await firstValueFrom(service.setInvitedNewTeamMembers(
                teamIdMock,
                invitedNewMemberMocks
            ));

            expect(saveSuccess).true;

            expect(clusterStub.pipeline.called).true;
            expect(syncdayRedisServiceStub.getInvitedNewMemberKey.called).true;
            expect(pipelineStub.sadd.called).true;
            expect(pipelineStub.exec.called).true;
        });
    });

    it('should be removed team invitations for invitation complete', async () => {

        const userEmail = stubOne(User).email;

        clusterStub.del.resolves(1);

        const deleteSuccess = await firstValueFrom(service.deleteTeamInvitations(userEmail));

        expect(deleteSuccess).true;

        expect(clusterStub.del.called).true;

        clusterStub.del.reset();
    });
});
