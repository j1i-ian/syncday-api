/**
 * 결제 상태 ( 현재 결제의 상태를 나타냅니다. 결제 검증에서 가장 중요한 지표가 됩니다. )
 * 0 - 결제 대기 상태입니다. 승인이 나기 전의 상태입니다.
 * 1 - 결제 완료된 상태입니다.
 * 2 - 결제승인 전 상태입니다. transactionConfirm() 함수를 호출하셔서 결제를 승인해야합니다.
 * 3 - 결제승인 중 상태입니다. PG사에서 transaction 처리중입니다.
 * 20 - 결제가 취소된 상태입니다.
 * -20 - 결제취소가 실패한 상태입니다.
 * -30 - 결제취소가 진행중인 상태입니다.
 * -1 - 오류로 인해 결제가 실패한 상태입니다.
 * -2 - 결제승인이 실패하였습니다.
 *
 * @see https://docs.bootpay.co.kr/?front=android-java&backend=nodejs#confirm-response
 */
export enum BootpayPGPaymentStatus {

    WAITING = 0,
    COMPLETE = 1,
    BEFORE_APPROVEMENT = 2,
    CANCELLED = 20,
    CANCELATION_FAILED = -20
}
