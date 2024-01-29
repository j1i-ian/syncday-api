/**
 * @see {@link [Kakaotalk Develoeprs API Document](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#request-token)}
 */
export interface KakaotalkOAuth2TokenResponse {

    /**
     * 토큰 타입
     */
    token_type: string;
    /**
     * 사용자 액세스 토큰 값
     */
    access_token: string;
    /**
     * ID 토큰 값
     */
    id_token: string;

    /**
     * 액세스 토큰과 ID 토큰의 만료 시간(초)
     * 참고: 액세스 토큰과 ID 토큰의 만료 시간은 동일
     */
    expires_in: number;

    /**
     * String 사용자 리프레시 토큰 값
     */
    refresh_token: string;

    /**
     * 리프레시 토큰 만료 시간(초)
     */
    refresh_token_expires_in: number;

    /**
     * 인증된 사용자의 정보 조회 권한 범위
     * 범위가 여러 개일 경우, 공백으로 구분
     */
    scope: string;
}
