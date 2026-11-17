import { http, HttpResponse } from 'msw';

import { hashCaptcha } from '@/lib/auth/loginCrypto';

// Dev-only browser mocks of the legacy login API (started from main.tsx).

// A 1x1 transparent PNG: a stand-in for the captcha image the real server draws.
const MOCK_CAPTCHA =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

export const MOCK_LOGIN_GUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const MOCK_OTP_GUID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

export const handlers = [
    // The legacy login contract: Initialize answers camelCase, the login calls answer PascalCase.
    http.get('**/api/Login/Initialize', () =>
        HttpResponse.json({
            isSuccessful: true,
            guid: MOCK_LOGIN_GUID,
            captcha: MOCK_CAPTCHA,
            maxAllowedTries: 5,
            goToWhitePageMessage: 'Too many attempts.',
            smsTimeInterval: 60,
            loginDuration: 600000,
            currentDateTicks: 0,
            maxTimeForDoingNothing: 0
        })
    ),

    // The mock cannot decrypt the username and password the way the server does, so it takes its
    // scenario from the captcha answer instead (the captcha is the one field it can check):
    //   0000 -> asks for a one-time code     1111 -> password expired     9999 -> refused
    //   anything else -> signed in
    http.post('**/api/Login/Login2', async ({ request }) => {
        const { captcha } = (await request.json()) as { captcha: string };
        const scenario = (answer: string): boolean =>
            captcha === hashCaptcha(answer, MOCK_LOGIN_GUID);

        return HttpResponse.json({
            IsSuccessful: !scenario('9999'),
            Message: scenario('9999') ? 'The mock refused this sign-in.' : '',
            ErrorCode: '0',
            Token: scenario('9999') ? null : 'mock-jwt-token',
            LoginStatus: scenario('1111') ? 1 : 0,
            GoToWhitePage: false,
            LoginGuid: MOCK_OTP_GUID,
            GoToOTPPasswordPage: scenario('0000')
        });
    }),

    // The one-time-code step accepts any code and a resend always succeeds.
    http.post('**/api/TwoFactorLogin/Login', () =>
        HttpResponse.json({
            IsSuccessful: true,
            Message: '',
            ErrorCode: '0',
            Token: 'mock-jwt-token',
            LoginStatus: 0,
            GoToWhitePage: false,
            LoginGuid: MOCK_OTP_GUID,
            GoToOTPPasswordPage: false
        })
    ),
    http.post('**/api/TwoFactorLogin/Retry', () =>
        HttpResponse.json({ IsSuccessful: true, Message: '', ErrorCode: '0', LoginStatus: 0 })
    ),

    http.post('**/api/Login/Logout', () => HttpResponse.json({ isSuccessful: true }))
];
