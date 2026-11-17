import { LOGIN_STATUS, type LoginResult } from '@/features/auth/api/login';

/** What the page should do with a login answer, decided apart from any React state. */
export type LoginOutcome =
    | { kind: 'otp'; loginGuid: string; token: string }
    | { kind: 'success'; token: string; mustChangePassword: boolean }
    /** The server closed this login page (too many tries, or it sat idle too long). */
    | { kind: 'blocked'; message: string }
    /** The customer must use the previous portal. */
    | { kind: 'notAllowed' }
    | { kind: 'refused'; message: string; errorCode: string };

const PASSWORD_CHANGE_STATUSES: readonly number[] = [
    LOGIN_STATUS.PASSWORD_EXPIRED,
    LOGIN_STATUS.PASSWORD_MUST_BE_CHANGED
];

export const classifyLogin = (result: LoginResult): LoginOutcome => {
    if (!result.isSuccessful) {
        if (result.goToWhitePage) return { kind: 'blocked', message: result.message };
        if (result.loginStatus === LOGIN_STATUS.NOT_ALLOWED) return { kind: 'notAllowed' };
        return { kind: 'refused', message: result.message, errorCode: result.errorCode };
    }

    // A success with no token cannot start a session: treat it as a refusal rather than signing in.
    if (!result.token) return { kind: 'refused', message: '', errorCode: result.errorCode };

    if (result.requiresOtp && result.loginGuid) {
        return { kind: 'otp', loginGuid: result.loginGuid, token: result.token };
    }

    return {
        kind: 'success',
        token: result.token,
        mustChangePassword: PASSWORD_CHANGE_STATUSES.includes(result.loginStatus)
    };
};
