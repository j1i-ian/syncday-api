import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Language } from '@app/enums/language.enum';
import { GoogleIntegration } from '../../../@core/core/entities/integrations/google/google-integration.entity';
import { TestMockUtil } from '@test/test-mock-util';
import { MailerService } from '@nestjs-modules/mailer';
import { IntegrationsService } from './integrations.service';
import { FileUtilsService } from '../util/file-utils/file-utils.service';

const testMockUtil = new TestMockUtil();

describe('IntegrationsService', () => {
    let service: IntegrationsService;

    let configServiceStub: sinon.SinonStubbedInstance<ConfigService>;
    let fileUtilsServiceStub: sinon.SinonStubbedInstance<FileUtilsService>;
    let mailerServiceStub: sinon.SinonStubbedInstance<MailerService>;
    let googleIntegrationRepositoryStub: sinon.SinonStubbedInstance<Repository<GoogleIntegration>>;
    before(async () => {
        configServiceStub = sinon.createStubInstance(ConfigService);
        fileUtilsServiceStub = sinon.createStubInstance(FileUtilsService);
        mailerServiceStub = sinon.createStubInstance(MailerService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IntegrationsService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: FileUtilsService,
                    useValue: fileUtilsServiceStub
                },
                {
                    provide: MailerService,
                    useValue: mailerServiceStub
                },
                {
                    provide: getRepositoryToken(GoogleIntegration),
                    useValue: googleIntegrationRepositoryStub
                }
            ]
        }).compile();

        service = module.get<IntegrationsService>(IntegrationsService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    describe('Test Verification email sent', () => {
        afterEach(() => {
            fileUtilsServiceStub.getEmailTemplate.reset();
            mailerServiceStub.sendMail.reset();
        });

        it('should be sent verification email', async () => {
            const emailSourceStub = '{{host}} {{email}} {{verificationCode}}';
            const emailSubjectSourceStub = '[Sync] 이메일 주소를 확인해주세요';

            const verificationMock = testMockUtil.getVerificationMock();

            fileUtilsServiceStub.getEmailTemplate.resolves(emailSourceStub);
            fileUtilsServiceStub.getEmailSubject.resolves(emailSubjectSourceStub);

            mailerServiceStub.sendMail.resolves('success');

            const result = await service.sendVerificationEmail(verificationMock, Language.ENGLISH);

            expect(fileUtilsServiceStub.getEmailTemplate.called).true;
            expect(mailerServiceStub.sendMail.called).true;

            expect(result).true;
        });
    });
});
