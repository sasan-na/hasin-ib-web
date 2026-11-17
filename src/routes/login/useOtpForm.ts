import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState, type BaseSyntheticEvent } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useCountdown } from '@/hooks/use-countdown';
import { ApiError } from '@/lib/api/client';
import { loginWithOtp, retryOtp } from '@/lib/api/login';
import { logger } from '@/lib/logger';

import { SESSION_EXPIRED_ERROR_CODE, type OtpContext, type SignedIn } from './loginFlow';
import { classifyLogin, type LoginOutcome } from './loginOutcome';
import { createOtpSchema, type OtpFormData } from './loginSchema';

interface OtpFormOptions {
    context: OtpContext;
    onSignedIn: (signedIn: SignedIn) => void;
    /** The sign-in session is gone: go back to the credentials step with this message. */
    onRestart: (message: string) => void;
}

interface UseOtpForm {
    form: UseFormReturn<OtpFormData>;
    onSubmit: (event?: BaseSyntheticEvent) => void;
    blockedMessage: string | null;
    /** A confirmation that is not an error, such as "a new code was sent". */
    notice: string | null;
    resend: {
        secondsLeft: number;
        canResend: boolean;
        isResending: boolean;
        onResend: () => void;
    };
}

export const useOtpForm = ({ context, onSignedIn, onRestart }: OtpFormOptions): UseOtpForm => {
    const { t } = useTranslation(['auth', 'errors']);
    const schema = useMemo(() => createOtpSchema(t), [t]);
    const form = useForm<OtpFormData>({
        resolver: zodResolver(schema),
        defaultValues: { otp: '' }
    });
    const countdown = useCountdown(context.smsIntervalSeconds);

    const [failedAttempts, setFailedAttempts] = useState(0);
    const [serverBlock, setServerBlock] = useState<string | null>(null);
    const [isResending, setIsResending] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const blockedMessage =
        serverBlock ??
        (failedAttempts >= context.maxAllowedTries
            ? context.goToWhitePageMessage || t('auth:login.error.blocked')
            : null);

    const fail = (message: string): void => {
        form.setError('root', { message });
        form.setValue('otp', '');
        setFailedAttempts((count) => count + 1);
    };

    // A request that never reached the server is not a wrong answer: no attempt is used up.
    const reportRequestError = (error: unknown): void => {
        logger.warn('One-time-code request failed', { error: String(error) });
        if (error instanceof ApiError) fail(t('errors:api.unknown'));
        else form.setError('root', { message: t('auth:login.error.network') });
    };

    const applyOutcome = (outcome: LoginOutcome): void => {
        switch (outcome.kind) {
            case 'success':
                onSignedIn({
                    username: context.username,
                    token: outcome.token,
                    mustChangePassword: outcome.mustChangePassword
                });
                return;
            case 'blocked':
                setServerBlock(outcome.message || t('auth:login.error.blocked'));
                return;
            case 'notAllowed':
                fail(t('auth:login.error.notAllowed'));
                return;
            case 'refused':
                if (outcome.errorCode === SESSION_EXPIRED_ERROR_CODE) {
                    onRestart(t('auth:login.error.sessionExpired'));
                } else {
                    fail(outcome.message || t('auth:login.error.failed'));
                }
                return;
            case 'otp':
                // Step 2 never asks for another code: treat it as a failed attempt.
                fail(t('auth:login.error.failed'));
        }
    };

    const submit = async (data: OtpFormData): Promise<void> => {
        if (blockedMessage !== null) return;
        setNotice(null);

        try {
            const result = await loginWithOtp({
                username: context.username,
                otp: data.otp,
                loginGuid: context.loginGuid,
                token: context.token
            });
            applyOutcome(classifyLogin(result));
        } catch (error) {
            reportRequestError(error);
        }
    };

    const resend = async (): Promise<void> => {
        if (!countdown.isDone || isResending || blockedMessage !== null) return;
        setIsResending(true);
        setNotice(null);
        form.clearErrors('root');

        try {
            const result = await retryOtp({
                username: context.username,
                password: context.password,
                loginGuid: context.loginGuid
            });
            if (result.isSuccessful) {
                countdown.restart();
                setNotice(t('auth:login.otp.resent'));
            } else if (result.goToWhitePage) {
                setServerBlock(result.message || t('auth:login.error.blocked'));
            } else {
                form.setError('root', { message: result.message || t('auth:login.error.failed') });
            }
        } catch (error) {
            reportRequestError(error);
        } finally {
            setIsResending(false);
        }
    };

    const submitHandler = form.handleSubmit(submit);

    return {
        form,
        onSubmit: (event?: BaseSyntheticEvent): void => {
            void submitHandler(event);
        },
        blockedMessage,
        notice,
        resend: {
            secondsLeft: countdown.secondsLeft,
            canResend: countdown.isDone && !isResending,
            isResending,
            onResend: () => {
                void resend();
            }
        }
    };
};
