# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository.

## Project

IBN, the new Hasin internet bank web client, replacing the legacy AngularJS app. Built on a React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui starter. Login (credentials, optional one-time code), a minimal protected home and a `/change-password` stub exist; everything else is yet to be built.

## Standing rules

- **No tests, no TDD, no test tooling.** Check behaviour by running the app in Chrome (dev server + mocks).
- Keep the project lean: no custom gate scripts or heavy hooks. `npm run lint`, `npm run build` and `tsc` are the gate.
- No PR policy. Commit each slice separately: `type(scope): description`, header <= 96 characters.
- Persian (`fa`, default, RTL) and English (`en`) are both supported. Every user-visible string goes through i18n; use logical CSS (`ps/pe/ms/me`, `start/end`) so RTL works.
- Fonts: Dana (Persian glyphs, self-hosted in `public/fonts/dana`, proprietary) and Inter (Latin).

## Commands

```bash
npm run dev      # vite dev server (also: npm start); API calls are mocked (MSW)
npm run build    # tsc type-check, then vite build
npm run lint     # eslint, --max-warnings 0 - must pass with zero warnings
npm run preview  # serve the production build
```

**Package manager:** npm. Node is pinned via `.nvmrc` (`24`).

## Environment

See `.env.example`:

- `VITE_API_URL` - legacy server API root (e.g. `https://ib.radin.tech/api`); defaults to same-origin `/api`.
- `VITE_PASSWORD_RECOVERY_URL` - target of the "forgot password" link; the link is hidden while unset.
- `VITE_ENABLE_MSW` - `false` turns the dev-only mock server off to use a real backend.
- `VITE_LOG_LEVEL` - `debug` | `info` | `warn` | `error` | `silent` (`src/lib/logger.ts`).

## Dev mock scenarios

In dev, MSW (`src/mocks/handlers.ts`) answers the login API. The scenario is keyed on the captcha answer: `0000` asks for a one-time code, `1111` password expired (lands on `/change-password`), `9999` refused, anything else signs in. Mocks never run in production builds.

## Architecture

### Routing and session

`src/routing.tsx` is the single source of truth for routes (`routeMap` holds paths and breadcrumb i18n keys; reference `routeMap.x.path`, never hardcode paths). `/login` is public; everything else sits behind `RequireAuth`, which redirects to login when there is no session token. Route components are `React.lazy`; each shell wraps its outlet in an error boundary + suspense (`RouteFrame` in `src/components/shell.tsx`).

The session (`src/store/session.ts`, Zustand) is **memory-only**: a refresh signs the user out. Never put the token or anything sensitive in `localStorage`/`sessionStorage`.

### Login contract (legacy server, verified against its code)

- `src/lib/auth/loginCrypto.ts`: username/password are AES-256-CBC (key = login GUID without dashes as 32 UTF-8 bytes, IV = sixteen `"0"`, PKCS7, base64), username lower-cased; captcha value = base64(MD5(guid + salt + lower(captcha))).
- The GUID is **single-use**: every Login2 attempt consumes it, so the page re-initialises after each attempt (`src/routes/login/useLoginForm.ts`).
- `Login/Initialize` answers camelCase; `Login2`, `TwoFactorLogin/Login` and `TwoFactorLogin/Retry` answer PascalCase (`src/lib/api/login.ts`). `LoginStatus`: 0 ok, 1 password expired, 2 must change password, 3 not allowed, -1 failure.
- `src/lib/api/client.ts` sends the token in the raw `Authorization` header (no `Bearer`), `X-XSRF-TOKEN` from the `XSRF-TOKEN` cookie, and `credentials: "include"`. `ErrorCode "401"` means the session expired.
- zod runs jitless (`src/lib/zod.ts`) so a CSP without `unsafe-eval` works; import `z` from `@/lib/zod`, never from `zod`.

### i18n

`src/lib/i18n/index.ts` bundles `src/locales/{fa,en}/{common,errors,auth}.json` (no HTTP backend), defaults to `fa`, persists the choice in `localStorage["i18nextLng"]` and keeps `<html lang dir>` in step. `public/theme-boot.js` applies the stored theme/language before first paint. `t()` is type-checked against the English JSON (`i18next.d.ts`). To add a namespace: add the JSON for both languages and register it in `resources` and `ns`.

### Logging, theme, UI

- All logging goes through `src/lib/logger.ts`; `no-console` is on (only `warn`/`error` allowed).
- Theme: `useSelectTheme()` applies `localStorage["vite-ui-theme"]`.
- shadcn/ui (`new-york`, Tailwind v4, no JS config): primitives live in `src/components/ui/`; theme tokens are in `src/index.css`. Radix imports use the unified `radix-ui` package; toasts go through `sonner`; icons from `lucide-react`; path alias `@/` -> `src/`.

## Lint/format gotchas

- `noUnusedLocals` / `noUnusedParameters` are on - the build fails on unused symbols.
- ESLint is flat config (`eslint.config.js`); `public/` is ignored. The `react-hooks` v7 purity and set-state-in-effect rules are enabled.
- Prettier: `semi: false`, `useTabs: true`.
