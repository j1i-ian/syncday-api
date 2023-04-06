import { Test, TestingModule } from '@nestjs/testing';
import { EmailTemplate } from '../../enums/email-template.enum';
import { Language } from '../../enums/language.enum';
import { UtilService } from './util.service';

describe('UtilService', () => {
    let service: UtilService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [UtilService]
        }).compile();

        service = module.get<UtilService>(UtilService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });

    it('should be generated for uuid', () => {
        const uuidMap = new Map<string, boolean>();

        Array(10)
            .fill(0)
            .map(() => service.generateUUID())
            .forEach((generatedUUID: string) => {
                expect(uuidMap.has(generatedUUID)).false;
                uuidMap.set(generatedUUID, false);
                expect(generatedUUID).ok;
            });
    });

    it('should be generated with padding', () => {
        const digits = 4;
        Array(10)
            .fill(0)
            .map(() => service.generateRandomNumberString(digits))
            .forEach((generatedRandomNumberString) => {
                expect(generatedRandomNumberString.length).eq(4);
            });
    });

    it('should be got asset full path', () => {
        const fullPath = service.getAssetFullPath(EmailTemplate.VERIFICATION, Language.ENGLISH);

        expect(fullPath).ok;
        expect(fullPath).contains('hbs');
    });
});
