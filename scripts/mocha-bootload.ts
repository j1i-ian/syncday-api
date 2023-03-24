/* eslint-disable @typescript-eslint/no-explicit-any */
import * as chai from 'chai';

import * as chaiAsPromised from 'chai-as-promised';

import * as sinon from 'sinon';

chai.use(chaiAsPromised);

(globalThis as any).sinon = sinon;
(globalThis as any).stubQueryBuilder = typeormFaker.stubQueryBuilder;
