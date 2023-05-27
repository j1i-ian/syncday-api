import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GetObjectCommandOutput, S3 } from '@aws-sdk/client-s3';
import { EmailTemplate } from '@app/enums/email-template.enum';
import { Language } from '@app/enums/language.enum';
import { UtilService } from '../util.service';
import { FileUtilsService } from './file-utils.service';

describe('File Util Service Test', () => {
    let service: FileUtilsService;

    const configServiceStub = {
        get: () => {}
    };

    let awsS3ServiceStub: sinon.SinonStubbedInstance<S3>;

    let utilServiceStub: sinon.SinonStubbedInstance<UtilService>;

    before(async () => {
        awsS3ServiceStub = sinon.createStubInstance(S3);
        utilServiceStub = sinon.createStubInstance(UtilService);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FileUtilsService,
                {
                    provide: ConfigService,
                    useValue: configServiceStub
                },
                {
                    provide: UtilService,
                    useValue: utilServiceStub
                },
                {
                    provide: 'AWS_SERVICE_UNDEFINED',
                    useValue: awsS3ServiceStub
                }
            ]
        }).compile();

        service = module.get<FileUtilsService>(FileUtilsService);
    });

    after(() => {
        sinon.restore();
    });

    it('Service Init Test', () => {
        expect(service).ok;
    });

    it('should got email template', async () => {
        utilServiceStub.getMailAssetFullPath.returns('fakeFullPath');

        const transformToStringSpy = sinon.spy();
        const getObjectCommandOutputStub = {
            Body: {
                transformToString: () => transformToStringSpy
            }
        };
        awsS3ServiceStub.getObject.resolves(
            getObjectCommandOutputStub as unknown as GetObjectCommandOutput
        );

        const result = await service.getEmailTemplate(EmailTemplate.VERIFICATION, Language.ENGLISH);

        expect(result).ok;
        expect(getObjectCommandOutputStub).ok;
    });
});
