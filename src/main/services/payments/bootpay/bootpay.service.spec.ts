/* eslint-disable @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
// import { BootpayService } from './bootpay.service';

/**
 * on now, bootpay is not support esm module,
 * so mocha cannot load bootpay object from node lib modules.
 */
describe.skip('BootpayService', () => {
    // let service: BootpayService;
    const service: any = true;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            // providers: [BootpayService]
        }).compile();

        // service = await module.resolve<BootpayService>(BootpayService);
    });

    it('should be defined', () => {
        expect(service).ok;
    });
});
