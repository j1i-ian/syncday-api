/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-len */
import { AccessTokenResponseParameters, CancelPaymentParameters, CertificateResponseParameters, DestroySubscribeResponseParameters, ReceiptResponseParameters, SubscriptionBillingRequestParameters, SubscriptionBillingResponseParameters, SubscriptionCardPaymentRequestParameters, UserTokenRequestParameters, UserTokenResponseParameters, SubscribePaymentReserveParameters, SubscribePaymentReserveResponse, CancelSubscribeReserveResponse, ShippingRequestParameters, CashReceiptPublishOnReceiptParameters, CashReceiptCancelOnReceiptParameters, RequestCashReceiptParameters, CancelCashReceiptParameters, RequestAuthenticateParameters, SubscribePaymentLookupResponse } from '@bootpay/backend-js/lib/response';
import { BootpayBackendNodejsResource } from '@bootpay/backend-js/lib/resource';

export declare class BootpayBackendNodejs extends BootpayBackendNodejsResource {
    constructor();
    /**
     * Get Access Token
     * Comment by GOSOMI
     *
     * @returns Promise<AccessTokenResponseParameters>
     */
    getAccessToken(): Promise<AccessTokenResponseParameters>;
    /**
     * Lookup Receipt
     * Comment by GOSOMI
     *
     * @param receiptId: string
     * @param lookupUserData: boolean
     */
    receiptPayment(receiptId: string, lookupUserData?: boolean): Promise<ReceiptResponseParameters>;
    /**
     * Cancel Payment
     * Comment by GOSOMI
     *
     * @param cancelPayment: CancelPaymentParameters
     * @returns Promise<CancelPaymentParameters>
     */
    cancelPayment(cancelPayment: CancelPaymentParameters): Promise<ReceiptResponseParameters>;
    /**
     * Lookup Certificate Data
     * Comment by GOSOMI
     *
     * @param receiptId: string
     * @returns Promise<CertificateResponseParameters>
     */
    certificate(receiptId: string): Promise<CertificateResponseParameters>;
    /**
     * ConfirmPayment
     * Comment by GOSOMI
     *
     * @param receiptId: string
     * @returns Promise<ReceiptResponseParameters>
     */
    confirmPayment(receiptId: string): Promise<ReceiptResponseParameters>;
    /**
     * lookupSubscribeBillingKey
     * Comment by GOSOMI
     *
     * @param receiptId: string
     * @returns Promise<SubscriptionBillingResponseParameters>
     */
    lookupSubscribeBillingKey(receiptId: string): Promise<SubscriptionBillingResponseParameters>;
    /**
     * requestSubscribeBillingKey
     * Comment by GOSOMI
     *
     * @param subscriptionBillingRequest: SubscriptionBillingRequestParameters
     * @returns Promise<SubscriptionBillingResponseParameters>
     */
    requestSubscribeBillingKey(subscriptionBillingRequest: SubscriptionBillingRequestParameters): Promise<SubscriptionBillingResponseParameters>;
    /**
     * requestSubscribeCardPayment
     * Comment by GOSOMI
     *
     * @param subscriptionCardRequest: SubscriptionCardPaymentRequestParameters
     * @returns Promise<ReceiptResponseParameters>
     */
    requestSubscribeCardPayment(subscriptionCardRequest: SubscriptionCardPaymentRequestParameters): Promise<ReceiptResponseParameters>;
    /**
     * destroyBillingKey
     * Comment by GOSOMI
     *
     * @param billingKey:string
     * @returns Promise<DestroySubscribeResponseParameters>
     */
    destroyBillingKey(billingKey: string): Promise<DestroySubscribeResponseParameters>;
    /**
     * requestUserToken
     * Comment by GOSOMI
     *
     * @param userTokenRequest:UserTokenRequestParameters
     * @returns Promise<UserTokenResponseParameters>
     */
    requestUserToken(userTokenRequest: UserTokenRequestParameters): Promise<UserTokenResponseParameters>;
    /**
     * subscribePaymentReserve
     * Comment by GOSOMI
     *
     * @param subscribePaymentReserveRequest:SubscribePaymentReserveParameters
     * @returns Promise<SubscribePaymentReserveResponse>
     */
    subscribePaymentReserve(subscribePaymentReserveRequest: SubscribePaymentReserveParameters): Promise<SubscribePaymentReserveResponse>;
    /**
     * SubscribeReserve Lookup
     * Comment by GOSOMI
     *
     * @date: 2023-03-07
     * @param reserveId: string
     * @returns Promise<SubscribeLookupResponse>
     */
    subscribePaymentReserveLookup(reserveId: string): Promise<SubscribePaymentLookupResponse>;
    /**
     * cancelSubscribeReserve
     * Comment by GOSOMI
     *
     * @param reserveId:string
     * @returns Promise<CancelSubscribeReserveResponse>
     */
    cancelSubscribeReserve(reserveId: string): Promise<CancelSubscribeReserveResponse>;
    /**
     * 배송시작 REST API 시작
     * Comment by GOSOMI
     *
     * @date: 2022-06-14
     */
    shippingStart(shippingRequest: ShippingRequestParameters): Promise<ReceiptResponseParameters | any>;
    /**
     * 기존결제 현금영수증 발행 API
     * Comment by GOSOMI
     *
     * @date: 2022-07-28
     */
    cashReceiptPublishOnReceipt(cashReceiptPublishRequest: CashReceiptPublishOnReceiptParameters): Promise<ReceiptResponseParameters>;
    /**
     * 기존 결제 현금영수증 발행 취소 API
     * Comment by GOSOMI
     *
     * @date: 2022-08-09
     */
    cashReceiptCancelOnReceipt(cashReceiptCancelRequest: CashReceiptCancelOnReceiptParameters): Promise<null>;
    /**
     * 별건 현금영수증 발행하기
     * Comment by GOSOMI
     *
     * @date: 2022-08-09
     */
    requestCashReceipt(cashReceiptRequest: RequestCashReceiptParameters): Promise<ReceiptResponseParameters>;
    /**
     * 별건 현금영수증 취소하기
     * Comment by GOSOMI
     *
     * @date: 2022-08-09
     */
    cancelCashReceipt(cancelCashReceiptRequest: CancelCashReceiptParameters): Promise<ReceiptResponseParameters>;
    /**
     * 본인인증 REST API 요청
     * Comment by GOSOMI
     *
     * @date: 2022-11-07
     */
    requestAuthentication(authenticateRequest: RequestAuthenticateParameters): Promise<CertificateResponseParameters>;
    /**
     * 본인인증 승인하기
     * Comment by GOSOMI
     *
     * @date: 2022-11-07
     */
    confirmAuthentication(receipt_id: string, otp?: null | string): Promise<CertificateResponseParameters>;
    /**
     * 본인인증 SMS 재전송
     * Comment by GOSOMI
     *
     * @date: 2022-11-07
     */
    realarmAuthentication(receipt_id: string): Promise<CertificateResponseParameters>;
}
declare const Bootpay: BootpayBackendNodejs;
export { Bootpay, ReceiptResponseParameters };
export default Bootpay;
