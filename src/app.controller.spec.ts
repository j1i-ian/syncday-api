import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { TestMockUtil } from '@test/test-mock-util';
import { AppController } from './app.controller';

describe('AppController', () => {
    let appController: AppController;

    let app: TestingModule;
    const datasourceMock = TestMockUtil.getDataSourceMock(() => app);

    beforeEach(async () => {
        app = await Test.createTestingModule({
            controllers: [AppController],
            providers: [
                {
                    provide: getDataSourceToken(),
                    useValue: datasourceMock
                }
            ]
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
