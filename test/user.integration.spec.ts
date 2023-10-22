import { INestApplication } from '@nestjs/common';
import { IntegrationContext } from '@interfaces/integrations/integration-context.enum';
import { UserService } from '@services/users/user.service';
import { User } from '@entity/users/user.entity';
import { TestIntegrationUtil } from './test-integration-util';

const testIntegrationUtil = new TestIntegrationUtil();

describe('User Integration Test', () => {

    let app: INestApplication;

    let userService: UserService;

    before(async () => {

        app = await testIntegrationUtil.initializeApp();
        userService = app.get<UserService>(UserService);
    });

    after(() => {

        testIntegrationUtil.reset();

        sinon.restore();
    });

    describe('User Features Test', () => {

        describe('Test Sign Up with email', () => {

            let fakeUser: User;

            beforeEach(async () => {

                fakeUser = testIntegrationUtil.getFakeUser();

                const loadedUser = await userService.findUserByEmail(fakeUser.email);

                if (loadedUser) {
                    await userService.deleteUser(loadedUser.id);
                }
            });

            it('should be signed up for user by email verification', async () => {

                await testIntegrationUtil.createEmailUser(fakeUser);
            });
        });

        describe('Sign In / Up with OAuth2', () => {
            let serviceSandbox: sinon.SinonSandbox;

            const userTimezoneISO8601Seoul = 'Asia/Seoul';
            const _SyncProductAuthTokenDummy = null;

            beforeEach(() => {
                serviceSandbox = sinon.createSandbox();
            });

            afterEach(() => {
                serviceSandbox.restore();
            });

            [
                {
                    description: 'Anonymous Users can sign in and sign up automatically to Sync with Google OAuth2. This is because most of the key customer groups, such as tech startups, use Google Workspace accounts for their work emails',
                    integrationContext: IntegrationContext.SIGN_IN,
                    initializingUserStatus: async () => {

                        const { email: newFakeUserEmail } = testIntegrationUtil.setNewFakeUserEmail(true);

                        const loadedUser = await userService.findUserByEmail(newFakeUserEmail);

                        if (loadedUser) {
                            await userService.deleteUser(loadedUser.id);
                        }
                    }
                },
                {
                    description: 'Anonymous Users can sign up to Sync with Google OAuth2',
                    integrationContext: IntegrationContext.SIGN_UP,
                    initializingUserStatus: async () => {

                        const { email: newFakeUserEmail } = testIntegrationUtil.setNewFakeUserEmail(true);

                        const loadedUser = await userService.findUserByEmail(newFakeUserEmail);

                        if (loadedUser) {
                            await userService.deleteUser(loadedUser.id);
                        }
                    }
                },
                {
                    description: 'Email Users can sign in with Google Integration automatically to Sync with Google OAuth2',
                    integrationContext: IntegrationContext.MULTIPLE_SOCIAL_SIGN_IN,
                    initializingUserStatus: async () => {

                        const fakeUser = testIntegrationUtil.setNewFakeUserEmail(true);

                        const loadedUser = await userService.findUserByEmail(fakeUser.email);

                        if (!loadedUser) {
                            await testIntegrationUtil.createEmailUser(fakeUser);
                        }
                    }
                },
                {
                    description: 'Any Users can integrate with Google to Sync for using Google Calendar',
                    integrationContext: IntegrationContext.INTEGRATE,
                    initializingUserStatus: async () => {
                        const fakeUser = testIntegrationUtil.setNewFakeUserEmail(true);

                        const loadedUser = await userService.findUserByEmail(fakeUser.email);

                        if (!loadedUser) {
                            await testIntegrationUtil.createEmailUser(fakeUser);
                        }
                    }
                }
            ].forEach(function({
                description,
                integrationContext,
                initializingUserStatus
            }) {
                it(description, async () => {

                    await initializingUserStatus();

                    await testIntegrationUtil.integrateGoogleOAuthUser(
                        integrationContext,
                        userTimezoneISO8601Seoul,
                        _SyncProductAuthTokenDummy,
                        serviceSandbox
                    );
                });
            });
        });
    });
});
