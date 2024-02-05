import { Test, TestingModule } from '@nestjs/testing';
import { Cluster, Pipeline } from 'ioredis';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
import { ProfilesRedisRepository } from '@services/profiles/profiles.redis-repository';
import { Team } from '@entity/teams/team.entity';
import { User } from '@entity/users/user.entity';
import { Order } from '@entity/orders/order.entity';
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

            pipelineStub.sismember.reset();
            pipelineStub.srem.reset();
            pipelineStub.exec.reset();

            clusterStub.smembers.reset();
            clusterStub.pipeline.reset();

            serviceSandbox.restore();
        });


        it('should be filtered already invited profiles', async () => {

            const teamMock = stubOne(Team);
            const invitedNewTeamMemberMocks = testMockUtil.getInvitedNewTeamMemberMocks(0);

            const emailOrPhoneBulkMock = invitedNewTeamMemberMocks.map((_invitedNewTeamMemberMock) => (_invitedNewTeamMemberMock.email || _invitedNewTeamMemberMock.phone) as string);

            const alreadyInvitedProfilePiepelineResultStub = [null, 1] as [error: Error | null, result: number];
            const pipelineResultStub = Array(emailOrPhoneBulkMock.length - 1).fill([null, 0]);

            const allPipelineResultStub = [alreadyInvitedProfilePiepelineResultStub].concat(pipelineResultStub);

            syncdayRedisServiceStub.getInvitedNewMemberKey.returnsArg(0);
            pipelineStub.sismember.returns(pipelineStub);
            pipelineStub.exec.resolves(allPipelineResultStub as Array<[error: Error | null, result: number]>);

            const filtered = await service.filterAlreadyInvited(
                teamMock.id,
                teamMock.uuid,
                emailOrPhoneBulkMock
            );

            expect(filtered).ok;
            expect(filtered.length).greaterThan(0);

            expect(pipelineStub.sismember.called).true;
            expect(pipelineStub.exec.called).true;
            expect(syncdayRedisServiceStub.getInvitedNewMemberKey.called).true;
        });

        it('should be got the team invitations', async () => {

            const teamStubs = stub(Team);
            const teamKeyStubs = teamStubs.map((_team) => `${_team.id}:${_team.uuid}`);
            const emailMock = stubOne(User).email as string;

            clusterStub.smembers.resolves(teamKeyStubs);

            const loadedTeamIds = await service.getTeamInvitations(
                emailMock
            );

            expect(loadedTeamIds).ok;
            expect(loadedTeamIds.length).greaterThan(0);

            expect(clusterStub.smembers.called).true;
        });

        it('should be got all team invitations', async () => {
            const teamUUIDMock = stubOne(Team).uuid;

            const emailOrPhoneBulkStub = testMockUtil.getInvitedNewTeamMemberMocks(0).map((_invitedNewTeamMemberMock) => (_invitedNewTeamMemberMock.email || _invitedNewTeamMemberMock.phone) as string);

            clusterStub.smembers.resolves(emailOrPhoneBulkStub);

            const emailOrPhoneBulk = await service.getAllTeamInvitations(teamUUIDMock);

            expect(emailOrPhoneBulk).ok;
            expect(emailOrPhoneBulk.length).greaterThan(0);
            expect(clusterStub.smembers.called).true;
        });

        it('should be set the team invitations for new member', async () => {

            const orderMock = stubOne(Order);
            const teamMock = stubOne(Team);
            const invitedNewMemberMocks = testMockUtil.getInvitedNewTeamMemberMocks(teamMock.id);

            syncdayRedisServiceStub.getInvitedNewMemberKey.returnsArg(0);
            syncdayRedisServiceStub.getTeamInvitationsKey.returnsArg(0);
            pipelineStub.exec.resolves([]);

            const saveSuccess = await service.setTeamInvitations(
                teamMock.id,
                teamMock.uuid,
                invitedNewMemberMocks,
                orderMock.id
            );

            expect(saveSuccess).true;

            expect(clusterStub.pipeline.called).true;
            expect(syncdayRedisServiceStub.getInvitedNewMemberKey.called).true;
            expect(pipelineStub.sadd.called).true;
            expect(pipelineStub.exec.called).true;
        });

        it('should be removed the team invitations as invitation complete', async () => {

            const teamMock = stubOne(Team);
            const userEmail = stubOne(User).email as string;

            clusterStub.exec.resolves([]);

            const deleteSuccess = await service.deleteTeamInvitations(teamMock.id, teamMock.uuid, userEmail);

            expect(deleteSuccess).true;

            expect(syncdayRedisServiceStub.getInvitedNewMemberKey.called).true;
            expect(syncdayRedisServiceStub.getTeamInvitationsKey.called).true;
            expect(clusterStub.pipeline.called).true;

            expect(pipelineStub.srem.called).true;
            expect(pipelineStub.exec.called).true;

            clusterStub.srem.reset();
        });
    });

});
