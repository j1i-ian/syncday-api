import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from '@config/app-config.service';

describe('App Integration Test', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    envFilePath: AppConfigService.getDotenvConfigs()
                })
            ]
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    // Feature Subject
    describe('Authentication', () => {

        it('should be noted that members can log in to Sync using the account they registered with their Google email. The majority of our key customer groups, such as tech startups, use Google Workspace accounts as their business email.', () => {
            expect(true).false;
        });
    });

});
