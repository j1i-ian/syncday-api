import { Cluster } from 'ioredis';
import { AppInjectCluster } from '@services/syncday-redis/app-inject-cluster.decorator';
import { SyncdayRedisService } from '@services/syncday-redis/syncday-redis.service';
// eslint-disable-next-line import/no-internal-modules
import { ReceiptResponseParameters } from '@bootpay/backend-js/lib/response';

export class PaymentRedisRepository {

    constructor(
        private readonly syncdayRedisService: SyncdayRedisService,
        @AppInjectCluster() private readonly cluster: Cluster
    ) {}

    async setPGPaymentResult(
        orderUUID: string,
        bootpayPaymentResult: ReceiptResponseParameters
    ): Promise<boolean> {
        const bootpayPaymentResultJsonString = JSON.stringify(bootpayPaymentResult);

        const pgPaymentKey = this.syncdayRedisService.getPGPaymentKey(orderUUID);
        const result = await this.cluster.set(pgPaymentKey, bootpayPaymentResultJsonString);

        return result === 'OK';
    }
}
