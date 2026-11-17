import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type BaseSyntheticEvent } from "react";
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/lib/api/client';
import { loginWithPassword, type LoginSession } from '@/lib/api/login';
import { loginSessionOptions } from '@/lib/api/login.queries';
import { normalizeDigits } from '@/lib/auth/normalizeDigits';
import { logger } from '@/lib/logger';

import type { OtpContext, SignedIn } from './loginFlow';
import { classifyLogin, type LoginOutcome } from './loginOutcome';
import { createLoginSchema, type LoginFormData } from './loginSchema';

export type CaptchaStatus = 'loading' | 'ready' | 'error';

interface UseLoginForm {
    form: UseFormReturn<LoginFormData>;
    onSubmit: (event?: BaseSyntheticEvent) => void;
    captcha: { status: CaptchaStatus; image: string | null; refresh: () => void };
    /** Set while the login page is closed to further attempts; the text to show. */
    blockedMessage: string | null;
    /** Back to a clean credentials step with `message` shown, and a fresh session. */
    restart: (message: string) => void;
}

interface LoginFormCallbacks {
    /** The server wants a one-time code next. */
    onOtp: (context: OtpContext) => void;
    onSignedIn: (signedIn: SignedIn) => void;
}

const captchaStatus = (query: {
    isFetching: boolean;
    isError: boolean;
    data?: unknown;
}): CaptchaStatus => {
    if (query.isFetching) return 'loading';
    if (query.isError) return 'error';
    return query.data ? 'ready' : 'loading';
};

/** The text to show while the page is closed, or `null` while it is open. */
const closedMessage = (
    serverBlock: string | null,
    session: LoginSession | undefined,
    failedAttempts: number,
    fallback: string
): string | null => {
    if (serverBlock !== null) return serverBlock;
    if (session && failedAttempts >= session.maxAllowedTries) {
        return session.goToWhitePageMessage || fallback;
    }
    return null;
};

export const useLoginForm = ({ onOtp, onSignedIn }: LoginFormCallbacks): UseLoginForm => {
    const { t } = useTranslation(['auth', 'errors']);

    const schema = useMemo(() => createLoginSchema(t), [t]);
    const form = useForm<LoginFormData>({
        resolver: zodResolver(schema),
        defaultValues: { username: '', password: '', captcha: '' }
    });

    const sessionQuery = useQuery(loginSessionOptions());
    const session = sessionQuery.data;
    const [failedAttempts, setFailedAttempts] = useState(0);
    const [serverBlock, setServerBlock] = useState<string | null>(null);

    const blockedMessage = closedMessage(
        serverBlock,
        session,
        failedAttempts,
        t('auth:login.error.blocked')
    );

    // A guid is single-use, so after any attempt the page needs a fresh one (and fresh answers).
    const startOver = async (): Promise<void> => {
        form.setValue('password', '');
        form.setValue('captcha', '');
        await sessionQuery.refetch();
    };

    const fail = async (message: string): Promise<void> => {
        form.setError('root', { message });
        setFailedAttempts((count) => count + 1);
        await startOver();
    };

    const applyOutcome = async (
        outcome: LoginOutcome,
        data: LoginFormData,
        loginSession: LoginSession
    ): Promise<void> => {
        const username = normalizeDigits(data.username).toLowerCase();
        switch (outcome.kind) {
            case 'success':
                onSignedIn({
                    username,
                    token: outcome.token,
                    mustChangePassword: outcome.mustChangePassword
                });
                return;
            case 'otp':
                onOtp({
                    username,
                    password: data.password,
                    loginGuid: outcome.loginGuid,
                    token: outcome.token,
                    maxAllowedTries: loginSession.maxAllowedTries,
                    goToWhitePageMessage: loginSession.goToWhitePageMessage,
                    smsIntervalSeconds: loginSession.smsIntervalSeconds
                });
                return;
            case 'blocked':
                setServerBlock(outcome.message || t('auth:login.error.blocked'));
                return;
            case 'notAllowed':
                await fail(t('auth:login.error.notAllowed'));
                return;
            case 'refused':
                await fail(outcome.message || t('auth:login.error.failed'));
        }
    };

    const submit = async (data: LoginFormData): Promise<void> => {
        if (blockedMessage !== null) return;
        if (!session || sessionQuery.isFetching || sessionQuery.isError) {
            form.setError('root', { message: t('auth:login.error.sessionMissing') });
            void sessionQuery.refetch();
            return;
        }

        try {
            const result = await loginWithPassword({ ...data, guid: session.guid });
            await applyOutcome(classifyLogin(result), data, session);
        } catch (error) {
            logger.warn('Login request failed', { error: String(error) });
            // A request that never reached the server did not use the guid up: keep the session.
            if (error instanceof ApiError) {
                await fail(t('errors:api.unknown'));
            } else {
                form.setError('root', { message: t('auth:login.error.network') });
            }
        }
    };

    const submitHandler = form.handleSubmit(submit);
    const onSubmit = (event?: BaseSyntheticEvent): void => {
        void submitHandler(event);
    };

    // The guid was used up by the attempt that led here, so a restart always fetches a new session.
    const restart = (message: string): void => {
        form.setError('root', { message });
        void startOver();
    };

    const status = captchaStatus(sessionQuery);

    return {
        form,
        onSubmit,
        captcha: {
            status,
            image: status === 'ready' && session ? session.captchaImage : null,
            refresh: () => {
                void startOver();
            }
        },
        blockedMessage,
        restart
    };
};
