# IBN - Hasin internet bank web client

The new web client for Hasin internet banking, replacing the legacy AngularJS app. React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, React Router 7, TanStack Query, react-hook-form + zod. Persian (default, RTL) and English.

**Status:** sign-in (credentials and one-time code), the forced password change, the home page (welcome, bank message, recent events) and the account area (landing page, account list with balances, search, groups and reordering, account details with rename, open account, delegation request, facility credit calculator). Account password, cards, cheques, transfers and the rest of the legacy menu are still to come.

## Getting started

```bash
nvm use            # Node 24, see .nvmrc
npm install
cp .env.example .env.local   # sets VITE_DEV_PROXY_TARGET, the real server for dev
npm run dev
```

The app talks to the real legacy server. `npm run dev` forwards `/api` to `VITE_DEV_PROXY_TARGET` (the server sends no CORS headers), so the copy of `.env.example` is needed to sign in.

## Checks

```bash
npm run lint    # zero warnings allowed
npm run build   # tsc + vite build
```

There is no test suite by design; verify behaviour by running the app.

## Notes

- The session is held in memory only, so reloading the page signs the user out.
- Dana (Persian font) is proprietary: put the license code in `public/fonts/dana/FontLicense.txt`.
- See [CLAUDE.md](./CLAUDE.md) for architecture and conventions.

Licensed under the MIT License (see `LICENSE`).
