/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { Cluster, RedisKey } from 'ioredis';
import { UtilService } from '@services/util/util.service';
import { TemporaryUser } from '@entity/users/temporary-user.entity';
import { AvailabilityBody } from '@app/interfaces/availability/availability-body.type';
import { TestMockUtil } from '../../../test/test-mock-util';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';
import { SyncdayRedisService } from './syncday-redis.service';
import { RedisStores } from './redis-stores.enum';

const testMockUtil = new TestMockUtil();

describe('Redis Service Test', () => {
    let service: SyncdayRedisService;

    let clusterStub: sinon.SinonStubbedInstance<Cluster>;
    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;

    beforeEach(async () => {
        clusterStub = sinon.createStubInstance(Cluster);
        utilServiceStub = sinon.createStubInstance(UtilService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                {
                    provide: getClusterToken(DEFAULT_CLUSTER_NAMESPACE),
                    useValue: clusterStub
                },
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                SyncdayRedisService
            ]
        }).compile();

        service = module.get<SyncdayRedisService>(SyncdayRedisService);
    });

    beforeEach(() => {
        clusterStub.get.reset();
        clusterStub.set.reset();
    });

    after(() => {
        sinon.restore();
    });

    it('service init test', () => {
        expect(service).ok;
    });

    describe('Test workspace status', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            clusterStub.set.reset();
            clusterStub.get.reset();
            serviceSandbox.restore();
        });

        it('should be saved temporary user', async () => {
            const tempUserStub = testMockUtil.getTemporaryUser();

            clusterStub.get.resolves(JSON.stringify(tempUserStub));

            const result: TemporaryUser = await service.getTemporaryUser(tempUserStub.email);

            expect(result.email).equals(tempUserStub.email);
        });

        it('should be got temporary user', async () => {
            const tempUserStub = testMockUtil.getTemporaryUser();

            clusterStub.set.resolves('OK');

            const result = await service.saveTemporaryUser(tempUserStub);

            expect(result).true;
        });

        it('should be got true when workspace is not assigned', async () => {
            const workspaceMock = 'thisisworkspacemock';

            clusterStub.get.resolves('true');

            serviceSandbox.stub(service, 'getWorkspaceAssignStatusKey').returns('workspaceKeyStub');

            const result = await service.getWorkspaceStatus(workspaceMock);

            expect(result).true;
        });

        it('should be got false when workspace is assigned', async () => {
            const workspaceMock = 'thisisworkspacemock';

            clusterStub.get.resolves('false');

            serviceSandbox.stub(service, 'getWorkspaceAssignStatusKey').returns('workspaceKeyStub');

            const result = await service.getWorkspaceStatus(workspaceMock);

            expect(result).false;
        });

        it('should be set true when workspace status is updated', async () => {
            const workspaceMock = 'thisisworkspacemock';

            serviceSandbox.stub(service, 'getWorkspaceAssignStatusKey').returns('workspaceKeyStub');

            clusterStub.set.resolves('OK');

            const result = await service.setWorkspaceStatus(workspaceMock);

            expect(result).true;
        });

        it('should be set true when workspace status is deleted', async () => {
            const workspaceMock = 'thisisworkspacemock';

            clusterStub.del.resolves(1);

            serviceSandbox.stub(service, 'getWorkspaceAssignStatusKey').returns('workspaceKeyStub');

            const result = await service.deleteWorkspaceStatus(workspaceMock);

            expect(result).true;
        });
    });

    describe('Test Email Verification', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            clusterStub.set.reset();
            clusterStub.get.reset();
            serviceSandbox.restore();
        });

        it('should be got email verification', async () => {
            const emailMock = TestMockUtil.faker.internet.email();

            const verificationStub = testMockUtil.getVerificationMock();
            const verificationStubString = JSON.stringify(verificationStub);

            serviceSandbox.stub(service, 'getEmailVerificationKey').returns(emailMock as RedisKey);
            clusterStub.get.resolves(verificationStubString);

            const verification = await service.getEmailVerification(emailMock);
            expect(verification).ok;
        });

        it('should be got getEmailVerificationStatus', async () => {
            const emailMock = TestMockUtil.faker.internet.email();
            const uuidMock = TestMockUtil.faker.datatype.uuid();

            const statusJsonStringStub = 'true';

            const keyStub = `local:alan@sync.day:${uuidMock}`;

            serviceSandbox.stub(service, <any>'getEmailVerificationStatusKey').returns(keyStub);

            clusterStub.get.resolves(statusJsonStringStub);

            const actualStatusJsonString = await service.getEmailVerificationStatus(
                emailMock,
                uuidMock
            );

            expect(actualStatusJsonString).true;
        });

        it('should be set email verification status', async () => {
            const emailMock = TestMockUtil.faker.internet.email();
            const uuidMock = TestMockUtil.faker.datatype.uuid();

            serviceSandbox
                .stub(service, 'getEmailVerificationStatusKey')
                .returns(emailMock as RedisKey);

            clusterStub.set.resolves('OK');

            const verification = await service.setEmailVerificationStatus(emailMock, uuidMock);
            expect(verification).true;
        });

        it('coverage fill: getInviteeQuestionKey', () => {
            const eventDetailUUIDMock = TestMockUtil.faker.datatype.uuid();

            serviceSandbox.stub(service, <any>'getRedisKey').returns(`local:event-detail:${eventDetailUUIDMock}:invitee-question`);

            const result = service.getInviteeQuestionKey(eventDetailUUIDMock);

            expect(result).ok;
        });

        it('coverage fill: getNotificationInfoKey', () => {
            const eventDetailUUIDMock = TestMockUtil.faker.datatype.uuid();

            serviceSandbox.stub(service, <any>'getRedisKey').returns(`local:event-detail:${eventDetailUUIDMock}:notifications`);

            const result = service.getNotificationInfoKey(eventDetailUUIDMock);

            expect(result).ok;
        });

        it('coverage fill: getEventSettingKey', () => {
            const eventDetailUUIDMock = TestMockUtil.faker.datatype.uuid();

            serviceSandbox.stub(service, <any>'getRedisKey').returns(`local:event-detail:${eventDetailUUIDMock}:event-setting`);

            const result = service.getEventSettingKey(eventDetailUUIDMock);

            expect(result).ok;
        });

        it('coverage fill: getTemporaryUserKey', () => {
            const emailMock = TestMockUtil.faker.internet.email();

            serviceSandbox.stub(service, <any>'getRedisKey').returns('local:workspaces');

            const result = service.getTemporaryUserKey(emailMock);

            expect(result).ok;
        });

        it('coverage fill: getEventLinkStatusKey', () => {
            const userUUIDMock = TestMockUtil.faker.datatype.uuid();

            serviceSandbox.stub(service, <any>'getRedisKey').returns('local:workspaces');

            const result = service.getEventLinkSetStatusKey(userUUIDMock);

            expect(result).ok;
        });

        it('coverage fill: getWorkspaceAssignStatusKey', () => {
            const emailMock = TestMockUtil.faker.internet.email();

            serviceSandbox.stub(service, <any>'getRedisKey').returns('local:workspaces');

            const result = service.getWorkspaceAssignStatusKey(emailMock);

            expect(result).ok;
        });

        it('coverage fill: getEmailVerificationKey', () => {
            const emailMock = TestMockUtil.faker.internet.email();

            serviceSandbox.stub(service, <any>'getRedisKey').returns('local:something:redis:key');

            const result = service.getEmailVerificationKey(emailMock);

            expect(result).ok;
        });

        it('coverage fill: getEmailVerificationStatusKey', () => {
            const emailMock = TestMockUtil.faker.internet.email();
            const uuid = 'mockuuid';

            serviceSandbox.stub(service, <any>'getRedisKey').returns('local:something:redis:key');

            const result = service.getEmailVerificationStatusKey(emailMock, uuid);

            expect(result).ok;
        });

        it('coverage fill: getRedisKey', () => {
            const result = (service as any)['getRedisKey'](RedisStores.TOKENS_USERS, [
                'test',
                'test2'
            ]);

            expect(result).ok;
        });
    });

    describe('Test Phone Verification', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            clusterStub.set.reset();
            clusterStub.get.reset();
            serviceSandbox.restore();
        });

        it('should be got phone verification', async () => {
            const phoneMock = TestMockUtil.faker.phone.number();

            const verificationStub = testMockUtil.getVerificationMock();
            const verificationStubString = JSON.stringify(verificationStub);

            serviceSandbox.stub(service, 'getPhoneVerificationKey').returns(phoneMock as RedisKey);
            clusterStub.get.resolves(verificationStubString);

            const verification = await service.getPhoneVerification(phoneMock);
            expect(verification).ok;
        });

        it('should be got getphoneVerificationStatus', async () => {
            const phoneMock = TestMockUtil.faker.phone.number();
            const uuidMock = TestMockUtil.faker.datatype.uuid();

            const statusJsonStringStub = 'true';

            const keyStub = `local:+821012345678:${uuidMock}`;

            serviceSandbox.stub(service, <any>'getPhoneVerificationStatusKey').returns(keyStub);

            clusterStub.get.resolves(statusJsonStringStub);

            const actualStatusJsonString = await service.getPhoneVerificationStatus(
                phoneMock,
                uuidMock
            );

            expect(actualStatusJsonString).true;
        });

        it('should be set phone verification status', async () => {
            const phoneMock = TestMockUtil.faker.phone.number();
            const uuidMock = TestMockUtil.faker.datatype.uuid();

            serviceSandbox
                .stub(service, 'getPhoneVerificationStatusKey')
                .returns(phoneMock as RedisKey);

            clusterStub.set.resolves('OK');

            const verification = await service.setPhoneVerificationStatus(phoneMock, uuidMock);
            expect(verification).true;
        });

        it('coverage fill: getPhoneVerificationKey', () => {
            const phoneMock = TestMockUtil.faker.phone.number();

            serviceSandbox.stub(service, <any>'getRedisKey').returns('local:something:redis:key');

            const result = service.getPhoneVerificationKey(phoneMock);

            expect(result).ok;
        });

        it('coverage fill: getPhoneVerificationStatusKey', () => {
            const phoneMock = TestMockUtil.faker.phone.number();
            const uuid = 'mockuuid';

            serviceSandbox.stub(service, <any>'getRedisKey').returns('local:something:redis:key');

            const result = service.getPhoneVerificationStatusKey(phoneMock, uuid);

            expect(result).ok;
        });

        it('coverage fill: getRedisKey', () => {
            const result = (service as any)['getRedisKey'](RedisStores.TOKENS_USERS, [
                'test',
                'test2'
            ]);

            expect(result).ok;
        });
    });

    describe('Test __parseHashmapRecords', () => {
        it('should be parsed for availability body', () => {
            const uuid = 'c77d4357-74b8-45c0-8b15-c2318f96cb4d';
            const uuid2 = 'c77d4357-64b8-45c0-8b15-c2318f96cb4d';
            const availabilityBodyMock = {
                // after redis loading, the json body would be stringified already.
                [uuid]: JSON.stringify({
                    availableTimes: [
                        {
                            day: 3,
                            timeRanges: [{ startTime: '09:00:00', endTime: '17:00:00' }]
                        },
                        {
                            day: 4,
                            timeRanges: [{ startTime: '09:00:00', endTime: '17:00:00' }]
                        }
                    ],
                    overrides: [
                        {
                            targetDate: new Date(),
                            timeRanges: [{ startTime: '09:00:00', endTime: '12:00:00' }]
                        }
                    ]
                } as AvailabilityBody),
                [uuid2]: JSON.stringify({
                    availableTimes: [
                        {
                            day: 5,
                            timeRanges: [{ startTime: '09:00:00', endTime: '18:00:00' }]
                        },
                        {
                            day: 6,
                            timeRanges: [{ startTime: '09:00:00', endTime: '19:10:00' }]
                        }
                    ],
                    overrides: [
                        {
                            targetDate: new Date(),
                            timeRanges: [{ startTime: '09:00:00', endTime: '12:00:00' }]
                        }
                    ]
                } as AvailabilityBody)
            } as Record<string, string>;

            const parsed = service.__parseHashmapRecords(availabilityBodyMock);

            expect(parsed).ok;

            const parsedBody = parsed[uuid] as AvailabilityBody;
            expect(parsedBody).ok;
            expect(parsedBody.availableTimes).ok;
            expect(parsedBody.availableTimes.length).greaterThan(0);
            expect(parsedBody.overrides).ok;

            const parsedSecondBody = parsed[uuid] as AvailabilityBody;
            expect(parsedSecondBody).ok;
            expect(parsedSecondBody.availableTimes).ok;
            expect(parsedSecondBody.availableTimes.length).greaterThan(0);
            expect(parsedSecondBody.overrides).ok;
        });
    });
});
