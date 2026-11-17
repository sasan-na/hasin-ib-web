# IBN - Hasin internet bank web client

The new web client for Hasin internet banking, replacing the legacy AngularJS app. React 19, Vite, TypeScript, Tailwind CSS v4, shadcn/ui, React Router 7, TanStack Query, react-hook-form + zod. Persian (default, RTL) and English.

**Status:** login (credentials and one-time code), a minimal protected home and a `/change-password` stub. Everything else is still to come.

## Getting started

```bash
nvm use            # Node 24, see .nvmrc
npm install
cp .env.example .env.local   # optional
npm run dev
```

In dev the legacy API is mocked. Type one of these as the security code to pick a scenario:

| Captcha | Result |
| ------- | ------ |
| `0000`  | one-time-code step |
| `1111`  | password expired, goes to `/change-password` |
| `9999`  | sign-in refused |
| other   | signed in |

Set `VITE_ENABLE_MSW=false` and `VITE_API_URL` to talk to a real server instead.

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
