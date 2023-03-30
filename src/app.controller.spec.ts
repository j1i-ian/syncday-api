import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
    let appController: AppController;

    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [AppController]
        }).compile();

        appController = app.get<AppController>(AppController);
    });

    describe('Health Check Test', () => {
        it('should return ok string for health check', () => {
            const healthCheckResult = appController.healthCheck();
            expect(healthCheckResult).equal('ok');
        });
    });
});
