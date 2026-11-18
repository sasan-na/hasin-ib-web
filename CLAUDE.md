# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository.

## Project

IBN, the new Hasin internet bank web client, replacing the legacy AngularJS app. Built on a React 19 + Vite + TypeScript + Tailwind CSS v4 + shadcn/ui starter. Built so far: sign-in (credentials and one-time code), the forced password change, the home page (welcome, bank message, wallet, quick transfer, most used services, recent events), the account area (landing, list, details, open account, delegation request, facility credit calculator, account password), the card area (list, details, actions, gift card, card-less cash), transfers (account, IBAN via Satna/Paya, card to card, group, standing orders with details and history), the account statement (with PDF and Excel export), bills (saved list, pay by account or card), cheques (list, book request, Pichak inquiry, register, issue a digital cheque with Hamoon, activate the digital cheque service, name and sign as guarantors, the digital cheque cartable, lock, unlock, cash, transfer and return a digital cheque, confirm, transfer, transfers chain, owner inquiry), messages, contacts, loans (list, pay an installment from an account or a card, pay another loan by number, follow or stop following, batch payment, interest calculators), reports (landing, events, monthly, periodic invoices, balance diagram), approvals (the dashboard cartable: waiting, finished, accept, reject or sign, which then sends the transaction), receipts (search, view, print, PDF) toll tags (ETC: list, balance, details, charge, activate, deactivate, block, buy a new tag), USSD subscription tokens, and the bank's menu landing pages for each section (accounts, cards, transfers, cheques, loans, payments, reports, approvals, other services). Also built: profile, change username, mobile banking login, settings (shown items, sign-in restrictions, home page layout with the notes calendar and balance chart widgets), global search, in-branch services (transfer, batch transfer with Excel import, send documents, facility contract, with an uploaded signed PDF, and the requests list), card PIN change, dynamic-password management, mobile top-up and charge card (voucher) purchase, connected cards (with Excel group operations), people (add, edit), roles and approval rules (create, edit, confirm, delete) and the old internet bank archive. Still to come: income and expenses (skipped on purpose), and signing a PDF inside the browser (the legacy used a local token plugin; here the signed PDF is uploaded).

## Standing rules

- **No tests, no TDD, no test tooling.** Check behaviour by running the app in Chrome (dev server against the real server).
- Keep the project lean: no custom gate scripts or heavy hooks. `npm run lint`, `npm run build` and `tsc` are the gate.
- No PR policy. Commit each slice separately: `type(scope): description`, header <= 96 characters.
- Persian (`fa`, default, RTL) and English (`en`) are both supported. Every user-visible string goes through i18n; use logical CSS (`ps/pe/ms/me`, `start/end`) so RTL works.
- Fonts: Dana Pro FaNum (full family incl. italics; Persian digits; self-hosted in `public/fonts/dana`, proprietary) leads in Persian, Inter leads in English.

## Commands

```bash
npm run dev      # vite dev server (also: npm start); /api is proxied to VITE_DEV_PROXY_TARGET
npm run build    # tsc type-check, then vite build
npm run lint     # eslint, --max-warnings 0 - must pass with zero warnings
npm run preview  # serve the production build
```

**Package manager:** npm. Node is pinned via `.nvmrc` (`24`).

## Environment

See `.env.example`:

- `VITE_API_URL` - legacy server API root (e.g. `https://ib.radin.tech/api`); defaults to same-origin `/api`.
- `VITE_PASSWORD_RECOVERY_URL` - target of the "forgot password" link; the link is hidden while unset.
- `VITE_DEV_PROXY_TARGET` - dev only: the dev server proxies same-origin `/api` here (the real server sends no CORS headers); leave `VITE_API_URL` unset when using it.
- `VITE_LOG_LEVEL` - `debug` | `info` | `warn` | `error` | `silent` (`src/lib/logger.ts`).

## Code layout

```
src/
  app/          router (router.tsx), route map (routes.ts), sign-in guard, shells + navigation (layout/), app-level pages (pages/)
  features/     one folder per area of the bank: auth, home, menu, account, card, transfer, transaction, report, loan, bill, cheque, message, contact, dashboard, receipt, etc
    <feature>/api/         endpoint calls with their zod schemas (x.ts) and TanStack Query options (x.queries.ts)
    <feature>/pages/       route components, named <name>-page.tsx, default export (the router lazy-loads these)
    <feature>/components/  pieces used by that feature's pages
    <feature>/hooks/       hooks;  <feature>/lib/  pure logic and types
  components/   shared components (ui/ is shadcn - keep it there so the CLI aliases work)
  hooks/        shared hooks
  lib/          shared helpers: api/ (fetch client, camelKeys, xsrf), i18n/, format, logger, query-client, zod, utils
  store/        app-wide Zustand state (session, theme)
  locales/      en/ and fa/ JSON
```

Rules: shared code (`components`, `hooks`, `lib`, `store`) never imports a feature. `app/` may import features (only their pages and hooks it needs for chrome). A feature may build on another's API or kit when it must (`account` uses `transaction` and `menu`); no cycles. Put code in the feature that owns it, and move it to a shared folder only when a second feature needs it. File names are kebab-case; imports use the `@/` alias across folders and `./` within one.

## Architecture

### Routing and session

`src/app/routes.ts` is the single source of truth for paths (`routeMap` holds paths and breadcrumb i18n keys; reference `routeMap.x.path`, never hardcode paths) and `src/app/router.tsx` maps them to pages. `/login` is public; everything else sits behind `RequireAuth` (`src/app/guards.tsx`), which redirects to login when there is no session token. Route components are `React.lazy`; each shell wraps its outlet in an error boundary + suspense (`RouteFrame` in `src/app/layout/shell.tsx`).

The session (`src/store/session.ts`, Zustand) is persisted in `sessionStorage` only (by the owner's choice, so a reload keeps the user signed in; it is tab-scoped and cleared on sign-out or expiry). Never put the token in `localStorage`.

### Login contract (legacy server, verified against its code)

- `src/features/auth/lib/login-crypto.ts`: username/password are AES-256-CBC (key = login GUID without dashes as 32 UTF-8 bytes, IV = sixteen `"0"`, PKCS7, base64), username lower-cased; captcha value = base64(MD5(guid + salt + lower(captcha))).
- The GUID is **single-use**: every Login2 attempt consumes it, so the page re-initialises after each attempt (`src/features/auth/hooks/use-login-form.ts`).
- `Login/Initialize` answers camelCase; `Login2`, `TwoFactorLogin/Login` and `TwoFactorLogin/Retry` answer PascalCase (`src/features/auth/api/login.ts`). `LoginStatus`: 0 ok, 1 password expired, 2 must change password, 3 not allowed, -1 failure.
- `src/lib/api/client.ts` sends the token in the raw `Authorization` header (no `Bearer`), `X-XSRF-TOKEN` from the `XSRF-TOKEN` cookie, and `credentials: "include"`. `ErrorCode "401"` means the session expired.
- zod runs jitless (`src/lib/zod.ts`) so a CSP without `unsafe-eval` works; import `z` from `@/lib/zod`, never from `zod`.

### i18n

`src/lib/i18n/index.ts` bundles `src/locales/{fa,en}/{common,errors,auth}.json` (no HTTP backend), defaults to `fa`, persists the choice in `localStorage["i18nextLng"]` and keeps `<html lang dir>` in step. `public/theme-boot.js` applies the stored theme/language before first paint. `t()` is type-checked against the English JSON (`i18next.d.ts`). To add a namespace: add the JSON for both languages and register it in `resources` and `ns`.

### Logging, theme, UI

- All logging goes through `src/lib/logger.ts`; `no-console` is on (only `warn`/`error` allowed).
- Theme: light / dark / system, chosen with `ThemeSwitcher`; the choice lives in `src/store/theme.ts` (`localStorage["vite-ui-theme"]`) and `useSelectTheme()` (`src/app/use-select-theme.ts`) applies it to `<html class="dark">`.
- shadcn/ui (`new-york`, Tailwind v4, no JS config): primitives live in `src/components/ui/`; theme tokens are in `src/index.css`. Radix imports use the unified `radix-ui` package; toasts go through `sonner`; icons from `lucide-react`; path alias `@/` -> `src/`.

## Lint/format gotchas

- `noUnusedLocals` / `noUnusedParameters` are on - the build fails on unused symbols.
- ESLint is flat config (`eslint.config.js`); `public/` is ignored. The `react-hooks` v7 purity and set-state-in-effect rules are enabled.
- Prettier: `semi: false`, `useTabs: true`.
