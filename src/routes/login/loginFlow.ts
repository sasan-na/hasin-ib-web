/** A completed sign-in, ready to become the app's session. */
export interface SignedIn {
    username: string;
    token: string;
    mustChangePassword: boolean;
}

/**
 * Everything the one-time-code step needs from the credentials step. The password stays in memory for
 * this step only, because asking the server to resend a code re-authenticates with it.
 */
export interface OtpContext {
    username: string;
    password: string;
    /** The encryption key and session id for this step (`LoginGuid` from the step-1 answer). */
    loginGuid: string;
    /** The token step 1 returned; the server reads the code's ticket out of it. */
    token: string;
    maxAllowedTries: number;
    goToWhitePageMessage: string;
    smsIntervalSeconds: number;
}

/** The server answers this `ErrorCode` when the sign-in session is no longer valid. */
export const SESSION_EXPIRED_ERROR_CODE = '401';
