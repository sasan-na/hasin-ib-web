/**
 * Login transport for the legacy server (`LoginController.cs`). Two things to know:
 *
 * - `Login/Initialize` answers camelCase, while Login2, TwoFactorLogin/Login and Retry answer PascalCase
 *   (the server serialises those with `JavaScriptSerializer`). Both are parsed here and mapped to one
 *   camelCase shape for the rest of the app.
 * - A `guid` is single-use: every Login2 attempt consumes it, so after ANY failure the page must call
 *   `initializeLogin` again for a fresh guid and captcha.
 */
import { encryptPassword, encryptUsername, hashCaptcha } from '@/lib/auth/loginCrypto';
import { normalizeDigits } from '@/lib/normalize-digits';
import {z} from '@/lib/zod';

import { ApiError, apiClient } from './client';

export const LOGIN_ENDPOINTS = {
    INITIALIZE: '/Login/Initialize',
    LOGIN: '/Login/Login2',
    OTP_LOGIN: '/TwoFactorLogin/Login',
    OTP_RETRY: '/TwoFactorLogin/Retry'
} as const;

/** `LoginStatus` in the server's answer (`LoginModel.LoginStatus`). */
export const LOGIN_STATUS = {
    SUCCESSFUL: 0,
    PASSWORD_EXPIRED: 1,
    PASSWORD_MUST_BE_CHANGED: 2,
    /** The customer may not use this portal and must use the old one. */
    NOT_ALLOWED: 3,
    UNSUCCESSFUL: -1
} as const;

export type LoginStatus = (typeof LOGIN_STATUS)[keyof typeof LOGIN_STATUS];

const MALFORMED_STATUS = 502;

const initializeSchema = z.object({
    isSuccessful: z.boolean(),
    message: z.string().nullish(),
    guid: z.string().nullish(),
    captcha: z.string().nullish(),
    maxAllowedTries: z.number().default(0),
    goToWhitePageMessage: z.string().nullish(),
    smsTimeInterval: z.number().default(60)
});

const loginResponseSchema = z.object({
    IsSuccessful: z.boolean(),
    Message: z.string().nullish(),
    ErrorCode: z.string().nullish(),
    Token: z.string().nullish(),
    LoginStatus: z.number().default(LOGIN_STATUS.UNSUCCESSFUL),
    GoToWhitePage: z.boolean().default(false),
    LoginGuid: z.string().nullish(),
    GoToOTPPasswordPage: z.boolean().default(false)
});

/** What the login page needs before it renders: the session guid, the captcha image and the limits. */
export interface LoginSession {
    guid: string;
    /** Base64 JPEG, ready for a `data:image/jpeg;base64,` URL. */
    captchaImage: string;
    maxAllowedTries: number;
    goToWhitePageMessage: string;
    /** Seconds before the one-time code can be requested again. */
    smsIntervalSeconds: number;
}

export interface LoginResult {
    isSuccessful: boolean;
    message: string;
    errorCode: string;
    token: string | null;
    loginStatus: number;
    goToWhitePage: boolean;
    /** The key for the one-time-code step; present when `requiresOtp`. */
    loginGuid: string | null;
    requiresOtp: boolean;
}

const malformed = (what: string): ApiError =>
    new ApiError(MALFORMED_STATUS, `Unexpected ${what} response from the server`);

export const initializeLogin = async (signal?: AbortSignal): Promise<LoginSession> => {
    const parsed = initializeSchema.safeParse(
        await apiClient<unknown>(LOGIN_ENDPOINTS.INITIALIZE, { signal })
    );
    if (!parsed.success) throw malformed('login initialisation');

    const { isSuccessful, guid, captcha, message } = parsed.data;
    if (!isSuccessful || !guid || !captcha) {
        throw new ApiError(MALFORMED_STATUS, message ?? 'The login page could not be prepared');
    }

    return {
        guid,
        captchaImage: captcha,
        maxAllowedTries: parsed.data.maxAllowedTries,
        goToWhitePageMessage: parsed.data.goToWhitePageMessage ?? '',
        smsIntervalSeconds: parsed.data.smsTimeInterval
    };
};

const toLoginResult = (raw: unknown): LoginResult => {
    const parsed = loginResponseSchema.safeParse(raw);
    if (!parsed.success) throw malformed('login');

    const data = parsed.data;
    return {
        isSuccessful: data.IsSuccessful,
        message: data.Message ?? '',
        errorCode: data.ErrorCode ?? '',
        token: data.Token === '' ? null : (data.Token ?? null),
        loginStatus: data.LoginStatus,
        goToWhitePage: data.GoToWhitePage,
        loginGuid: data.LoginGuid ?? null,
        requiresOtp: data.GoToOTPPasswordPage
    };
};

const post = async (
    endpoint: string,
    body: object,
    headers?: Record<string, string>
): Promise<LoginResult> =>
    toLoginResult(
        await apiClient<unknown>(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
            headers
        })
    );

export interface CredentialsInput {
    username: string;
    password: string;
    captcha: string;
    guid: string;
}

/** Step 1: username, password and the captcha answer. */
export const loginWithPassword = async ({
    username,
    password,
    captcha,
    guid
}: CredentialsInput): Promise<LoginResult> =>
    post(LOGIN_ENDPOINTS.LOGIN, {
        username: await encryptUsername(normalizeDigits(username), guid),
        password: await encryptPassword(password, guid),
        captcha: hashCaptcha(captcha, guid),
        guid
    });

export interface OtpInput {
    username: string;
    otp: string;
    /** `loginGuid` from the step-1 answer: it is the encryption key and the session id from here on. */
    loginGuid: string;
    /** The token step 1 returned; the server reads the one-time-code ticket out of it. */
    token: string;
}

/** Step 2: the one-time code sent by SMS. */
export const loginWithOtp = async ({
    username,
    otp,
    loginGuid,
    token
}: OtpInput): Promise<LoginResult> =>
    post(
        LOGIN_ENDPOINTS.OTP_LOGIN,
        {
            username: await encryptUsername(normalizeDigits(username), loginGuid),
            password: await encryptPassword(otp, loginGuid),
            guid: loginGuid
        },
        { Authorization: token }
    );

export interface RetryInput {
    username: string;
    /** The original password: the server re-authenticates it to send a new code. */
    password: string;
    loginGuid: string;
}

/** Asks the server to send a new one-time code. */
export const retryOtp = async ({
    username,
    password,
    loginGuid
}: RetryInput): Promise<LoginResult> =>
    post(LOGIN_ENDPOINTS.OTP_RETRY, {
        username: await encryptUsername(normalizeDigits(username), loginGuid),
        password: await encryptPassword(password, loginGuid),
        guid: loginGuid
    });
