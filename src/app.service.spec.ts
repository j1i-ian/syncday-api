import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
    let appService: AppService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [AppService]
        }).compile();

        appService = module.get<AppService>(AppService);
    });

    describe('root', () => {
        it('should return "Hello World!"', () => {
            const helloWorld = appService.getHello();
            expect(helloWorld).equal('Hello World!');
        });
    });
});
