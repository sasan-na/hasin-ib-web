import type { TFunction } from 'i18next';

import { z } from '@/lib/zod';

/** Field limits carried over from the legacy login form (`login.html`). */
export const LOGIN_LIMITS = {
    USERNAME_MAX: 64,
    PASSWORD_MIN: 8,
    PASSWORD_MAX: 35,
    CAPTCHA_MAX: 4,
    OTP_MIN: 5,
    OTP_MAX: 12
} as const;

const DIGITS_ONLY = /^[0-9]+$/;

type LoginT = TFunction<['auth', 'errors']>;

/**
 * Built per language: the messages are translated when the schema is made, so a language switch
 * rebuilds it (the hooks memoise on `t`).
 */
export const createLoginSchema = (
    t: LoginT
): z.ZodObject<{ username: z.ZodString; password: z.ZodString; captcha: z.ZodString }> =>
    z.object({
        username: z
            .string()
            .min(1, t('auth:login.error.required.username'))
            .max(
                LOGIN_LIMITS.USERNAME_MAX,
                t('auth:login.error.usernameMax', { max: LOGIN_LIMITS.USERNAME_MAX })
            ),
        password: z
            .string()
            .min(1, t('auth:login.error.required.password'))
            .min(
                LOGIN_LIMITS.PASSWORD_MIN,
                t('auth:login.error.passwordMin', { min: LOGIN_LIMITS.PASSWORD_MIN })
            )
            .max(
                LOGIN_LIMITS.PASSWORD_MAX,
                t('auth:login.error.passwordMax', { max: LOGIN_LIMITS.PASSWORD_MAX })
            ),
        captcha: z
            .string()
            .min(1, t('auth:login.error.required.captcha'))
            .regex(DIGITS_ONLY, t('auth:login.error.digitsOnly'))
    });

export type LoginFormData = z.infer<ReturnType<typeof createLoginSchema>>;

/** The one-time code: digits, 5 to 12 of them. */
export const createOtpSchema = (t: LoginT): z.ZodObject<{ otp: z.ZodString }> =>
    z.object({
        otp: z
            .string()
            .min(1, t('auth:login.error.required.otp'))
            .regex(DIGITS_ONLY, t('auth:login.error.digitsOnly'))
            .min(
                LOGIN_LIMITS.OTP_MIN,
                t('auth:login.error.otpLength', {
                    min: LOGIN_LIMITS.OTP_MIN,
                    max: LOGIN_LIMITS.OTP_MAX
                })
            )
            .max(
                LOGIN_LIMITS.OTP_MAX,
                t('auth:login.error.otpLength', {
                    min: LOGIN_LIMITS.OTP_MIN,
                    max: LOGIN_LIMITS.OTP_MAX
                })
            )
    });

export type OtpFormData = z.infer<ReturnType<typeof createOtpSchema>>;
