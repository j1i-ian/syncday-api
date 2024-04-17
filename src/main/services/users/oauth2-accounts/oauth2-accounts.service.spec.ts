import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { OAuth2AccountsModule } from '@services/users/oauth2-accounts/oauth2-accounts.module';
import { User } from '@entity/users/user.entity';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { OAuth2AccountsService } from './oauth2-accounts.service';

describe('OAuth2AccountsService', () => {
    let service: OAuth2AccountsService;

    let module: TestingModule;
    const datasourceMock = TestMockUtil.getDataSourceMock(() => module);

    let oauth2AccountRepositoryStub: sinon.SinonStubbedInstance<Repository<OAuth2AccountsModule>>;

    before(async () => {

        oauth2AccountRepositoryStub = sinon.createStubInstance<Repository<OAuth2AccountsModule>>(Repository);

        module = await Test.createTestingModule({
            providers: [
                OAuth2AccountsService,
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                },
                {
                    provide: getRepositoryToken(OAuth2Account),
                    useValue: oauth2AccountRepositoryStub
                }
            ]
        }).compile();

        service = module.get<OAuth2AccountsService>(OAuth2AccountsService);
    });

    afterEach(() => {
        oauth2AccountRepositoryStub.save.reset();
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('OAuth2 Account fetching test', () => {

        beforeEach(() => {

            const oauth2AccountsStub = stub(OAuth2Account);

            oauth2AccountRepositoryStub.findBy.resolves(oauth2AccountsStub);
        });

        afterEach(() => {
            oauth2AccountRepositoryStub.findBy.reset();
        });

        it('should be fetched oauth 2 accounts', async () => {

            const userIdMock = stubOne(User).id;
            const actualFoundOAuth2Account = await firstValueFrom(service.find(userIdMock));

            expect(actualFoundOAuth2Account).ok;
            expect(oauth2AccountRepositoryStub.findBy.called).true;
        });
    });


    it('should be found a oauth 2 account', async () => {

        const userEmail = stubOne(User).email as string;
        const oauth2AccountStub = stubOne(OAuth2Account);

        oauth2AccountRepositoryStub.findOne.resolves(oauth2AccountStub);

        const actualFoundOAuth2Account = await service.findOneByEmail(userEmail);

        expect(actualFoundOAuth2Account).ok;
        expect(oauth2AccountRepositoryStub.findOne.called).true;
    });

    describe('Test OAuth2 Account Creating', () => {

        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            oauth2AccountRepositoryStub.save.reset();
            oauth2AccountRepositoryStub.findOneBy.reset();

            serviceSandbox.restore();
        });

        it('should be created a oauth2 account without transaction', async () => {
            const userMockStub = stubOne(User);
            const newOauth2AccountMock = stubOne(OAuth2Account);

            newOauth2AccountMock.user = userMockStub;
            serviceSandbox.stub(service, '_create').resolves(newOauth2AccountMock);

            const actualCreatingResult = await service.create(
                userMockStub,
                newOauth2AccountMock
            );

            expect(actualCreatingResult).ok;
            expect(actualCreatingResult.user).deep.equals(userMockStub);
        });

        it('should be created a oauth2 account with transaction', async () => {
            const userMockStub = stubOne(User);
            const newOauth2AccountMock = stubOne(OAuth2Account);

            newOauth2AccountMock.user = userMockStub;
            oauth2AccountRepositoryStub.findOneBy.resolves(null);
            oauth2AccountRepositoryStub.save.resolves(newOauth2AccountMock);

            const actualCreatingResult = await service._create(
                datasourceMock as any as EntityManager,
                userMockStub,
                newOauth2AccountMock
            );

            expect(actualCreatingResult).ok;
            expect(actualCreatingResult.user).deep.equals(userMockStub);
            expect(oauth2AccountRepositoryStub.save.called).true;
        });

        it('should be not created the dupilcated oauth2 account', async () => {
            const userMockStub = stubOne(User);
            const newOauth2AccountMock = stubOne(OAuth2Account);

            newOauth2AccountMock.user = userMockStub;
            oauth2AccountRepositoryStub.findOneBy.resolves(newOauth2AccountMock);
            oauth2AccountRepositoryStub.save.resolvesArg(0);

            const actualCreatingResult = await service._create(
                datasourceMock as any as EntityManager,
                userMockStub,
                newOauth2AccountMock
            );

            expect(actualCreatingResult).ok;
            expect(actualCreatingResult.user).deep.equals(userMockStub);
            expect(oauth2AccountRepositoryStub.findOneBy.called).true;
            expect(oauth2AccountRepositoryStub.save.called).false;

        });
    });

});
