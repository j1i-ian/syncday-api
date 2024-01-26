import { INestApplication } from '@nestjs/common';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { IntegrationsController } from '@services/integrations/integrations.controller';
import { UserService } from '@services/users/user.service';
import { User } from '@entities/users/user.entity';
import { TooManyIntegrationRequestException } from '@exceptions/integrations/too-many-integration-request.exception';
import { TestIntegrationUtil } from './test-integration-util';

const testIntegrationUtil = new TestIntegrationUtil();

describe('Integration Integration Test', () => {

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const INTEGRATION_MAX_ADD_LIMIT = 6;

    let app: INestApplication;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let integrationsController: IntegrationsController;

    let userService: UserService;

    before(async () => {

        app = await testIntegrationUtil.initializeApp();

        integrationsController = app.get<IntegrationsController>(IntegrationsController);

        userService = app.get<UserService>(UserService);
    });

    after(() => {

        testIntegrationUtil.reset();

        sinon.restore();
    });

    describe('Integration Adding limit Test', () => {
        let serviceSandbox: sinon.SinonSandbox;

        const userTimezoneISO8601Seoul = 'Asia/Seoul';

        let fakeUser: User;
        let fakeUserAccessToken: string;

        beforeEach(async () => {
            serviceSandbox = sinon.createSandbox();

            fakeUser = testIntegrationUtil.getFakeUser();

            const loadedUser = await userService.findUserByLocalAuth(fakeUser.email);

            if (loadedUser) {
                await userService.deleteUser(loadedUser.id);
            }
        });

        afterEach(() => {
            testIntegrationUtil.resetAppleCalendarServiceStubs();

            serviceSandbox.restore();
        });

        [
            {
                description: 'Host cannot add integration over limit for Google Integration',
                initializingUserStatus: async () => {

                    const loadedUser = await userService.findUserByLocalAuth(fakeUser.email);

                    if (!loadedUser) {

                        const newFakeUser = testIntegrationUtil.setNewFakeUserEmail(true);

                        await testIntegrationUtil.createEmailUser(newFakeUser);

                        fakeUser = await userService.findUserByLocalAuth(newFakeUser.email) as User;

                        fakeUserAccessToken = testIntegrationUtil.getAccessToken(fakeUser);

                        testIntegrationUtil.setAppleCalendarStubs(fakeUser.email);

                        const integrationLimitHalf = INTEGRATION_MAX_ADD_LIMIT / 2;

                        await Promise.all(
                            Array(integrationLimitHalf).fill(0).map(async () => {
                                await testIntegrationUtil.integrateGoogleOAuthUser(
                                    IntegrationContext.INTEGRATE,
                                    userTimezoneISO8601Seoul,
                                    fakeUserAccessToken,
                                    serviceSandbox
                                );
                            })
                        );
                        await Promise.all(
                            Array(integrationLimitHalf).fill(0).map(async () => {
                                await testIntegrationUtil.integrateApple(
                                    fakeUser,
                                    'Asia/Seoul'
                                );
                            })
                        );
                    }
                }
            }
        ].forEach(function({
            description,
            initializingUserStatus
        }) {

            it(description, async () => {

                await initializingUserStatus();

                await expect(testIntegrationUtil.integrateGoogleOAuthUser(
                    IntegrationContext.INTEGRATE,
                    userTimezoneISO8601Seoul,
                    fakeUserAccessToken,
                    serviceSandbox
                )).rejectedWith(TooManyIntegrationRequestException);
            });
        });

    });
});
