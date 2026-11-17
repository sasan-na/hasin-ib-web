import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

/** Dev-only: intercepts API calls in the browser (see `main.tsx`). */
export const worker = setupWorker(...handlers);
