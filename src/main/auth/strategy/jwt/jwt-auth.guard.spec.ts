import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { firstValueFrom, of, throwError } from 'rxjs';
import { TestMockUtil } from '@test/test-mock-util';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PublicDecoratorOptions } from './public-decorator-options.interface';

const testMockUtil = new TestMockUtil();

describe('JwtAuthGuard Test', () => {
    let guard: JwtAuthGuard;
    let reflectorStub: sinon.SinonStubbedInstance<Reflector>;

    before(() => {
        reflectorStub = sinon.createStubInstance(Reflector);

        guard = new JwtAuthGuard(reflectorStub);
    });

    after(() => {
        sinon.restore();
    });

    it('should be defined', () => {
        expect(guard).ok;
    });

    describe('Test pass guard', () => {
        let serviceSandbox: sinon.SinonSandbox;

        beforeEach(() => {
            serviceSandbox = sinon.createSandbox();
        });

        afterEach(() => {
            serviceSandbox.restore();
        });

        [
            {
                description: 'should be passed when user requests with valid jwt token',
                jwtTokenMock: testMockUtil.getBearerTokenMock(),
                passportCanActive$: of(true),
                publicSettings: undefined,
                expectedValue: true
            },
            {
                description: 'should be not passed when user requests with invalid jwt token',
                jwtTokenMock: 'dummydummy.jwt.token',
                passportCanActive$: throwError(() => false),
                publicSettings: undefined,
                expectedValue: false
            },
            {
                description:
                    'should be passed when user requests to public api with valid jwt token',
                jwtTokenMock: testMockUtil.getBearerTokenMock(),
                passportCanActive$: of(true),
                publicSettings: {},
                expectedValue: true
            },
            {
                description:
                    'should be passed when user requests to public api with invalid jwt token and is allowed passing validation fail',
                jwtTokenMock: 'dummydummy.jwt.token',
                passportCanActive$: throwError(() => false),
                publicSettings: { ignoreInvalidJwtToken: true } as PublicDecoratorOptions,
                expectedValue: true
            }
        ].forEach(
            ({ description, jwtTokenMock, publicSettings, passportCanActive$, expectedValue }) => {
                it(description, async () => {
                    const argumentHostMock = testMockUtil.getArgumentHostMock(
                        {
                            headers: {
                                authorization: jwtTokenMock
                            }
                        },
                        () => {},
                        serviceSandbox
                    );

                    serviceSandbox
                        .stub(AuthGuard('jwt').prototype, 'canActivate')
                        .callsFake(() => passportCanActive$);

                    reflectorStub.getAllAndOverride.callsFake(() => publicSettings);

                    if (expectedValue) {
                        const loadedFirstValue = await firstValueFrom(
                            guard.canActivate(argumentHostMock as unknown as ExecutionContext)
                        );

                        expect(loadedFirstValue).equals(expectedValue);
                    } else {
                        await expect(
                            firstValueFrom(
                                guard.canActivate(argumentHostMock as unknown as ExecutionContext)
                            )
                        ).rejected;
                    }
                });
            }
        );
    });
});
