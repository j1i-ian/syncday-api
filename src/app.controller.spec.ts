import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { InternalServerErrorException } from '@nestjs/common';
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

    describe('Database Health Check Test', () => {

        it('should returned ok string for database health check', async () => {

            datasourceMock.setQuery([{ '1': 1 }]);

            const healthCheckResult = await appController.databaseHealthCheck();
            expect(healthCheckResult).equal('ok');
        });

        it('should not be returned ok string for database health check', async () => {

            datasourceMock.setQuery(
                new Promise((resolve) => {
                    setTimeout(() => resolve(null), 1500);
                })
            );

            await expect(appController.databaseHealthCheck()).rejectedWith(InternalServerErrorException);
        });
    });
});
