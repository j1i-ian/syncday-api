import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
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

    it('should be found a oauth 2 account', async () => {

        const userEmail = stubOne(User).email;
        const oauth2AccountStub = stubOne(OAuth2Account);

        oauth2AccountRepositoryStub.findOne.resolves(oauth2AccountStub);

        const actualFoundOAuth2Account = await service.findOneByEmail(userEmail);

        expect(actualFoundOAuth2Account).ok;
        expect(oauth2AccountRepositoryStub.findOne.called).true;
    });

    it('should be created a oauth2 account without transaction', async () => {
        const userMock = stubOne(User);
        const newOauth2AccountMock = stubOne(OAuth2Account);

        (oauth2AccountRepositoryStub as any).manager = datasourceMock as any;
        oauth2AccountRepositoryStub.save.resolves(newOauth2AccountMock);

        const actualCreatingResult = await service.create(
            userMock,
            newOauth2AccountMock
        );

        expect(actualCreatingResult).ok;
        expect(actualCreatingResult.user).deep.equals(userMock);
        expect(oauth2AccountRepositoryStub.save.called).true;

    });

    it('should be created a oauth2 account with transaction', async () => {
        const userMock = stubOne(User);
        const newOauth2AccountMock = stubOne(OAuth2Account);

        oauth2AccountRepositoryStub.save.resolves(newOauth2AccountMock);

        const actualCreatingResult = await service._create(
            datasourceMock as EntityManager,
            userMock,
            newOauth2AccountMock
        );

        expect(actualCreatingResult).ok;
        expect(actualCreatingResult.user).deep.equals(userMock);
        expect(oauth2AccountRepositoryStub.save.called).true;
    });
});
