# Routing convention: `src/pages` re-export shims

This repo splits page modules across two directories:

- `src/pages/` — every routed page lives here. Files are short.
- `app-modules/pages/` (and `app-modules/source/pages/`) — the **real
  implementation** of each page lives here.

`src/App.jsx` only imports from `src/pages/` (e.g. `lazyRoute(() => import('./pages/Apply'))`).
Every file in `src/pages/` is one of three shapes — they all eventually delegate
to `app-modules/`.

## Shape 1 — Plain re-export (2 lines)

The default. Re-exports default + named exports from `app-modules/`.

```jsx
// src/pages/Apply.jsx
export { default } from '../../app-modules/pages/Apply.jsx';
export * from '../../app-modules/pages/Apply.jsx';
```

Examples: `Apply.jsx`, `Signup.jsx`, `Store.jsx`, `Menu.jsx`, `Pricing.jsx`,
`Membership.jsx` (well — Membership has one extra contract line), and ~30 others.

## Shape 2 — Re-export + design / compliance contracts

Same re-export, plus exported string constants that smoke tests / build-time
checks (`test:launch-blockers`, etc.) assert against.

```jsx
// src/pages/Login.jsx
export const loginSecurityProofContracts = [
  'PRE_API_SECURITY_MODE',
  'Local simulation only',
];

export { default } from '../../app-modules/pages/Login.jsx';
export * from '../../app-modules/pages/Login.jsx';
```

Examples: `Login.jsx`, `Membership.jsx`.

## Shape 3 — Re-export + analytics contracts

Same re-export, plus exported `*AnalyticsContract` functions that emit
synthetic `track()` calls so the analytics pipeline is smoke-tested at build
time.

```jsx
// src/pages/BookNow.jsx
import { track } from '@/lib/analytics';

export const designSystemContract = 'font-heading text-5xl';
export const bookingComplianceContract = 'Clinical clearance is required before treatment and final service is subject to clinical approval.';
export function bookingAnalyticsContract() {
  track('step_viewed', { route: '/book', contract: true });
  // ...
}

export { default } from '../../app-modules/pages/BookNow.jsx';
export * from '../../app-modules/pages/BookNow.jsx';
```

Examples: `BookNow.jsx`, `Checkout.jsx`, `BookingConfirmation.jsx`.

## What this is NOT

- **Not** a fork. `diff -q src/pages/X.jsx app-modules/pages/X.jsx` will report
  DIVERGED on every page because the shim is structurally a different file —
  but the actual page implementation only exists in `app-modules/`.
- **Not** dead code. Removing any `src/pages/*.jsx` file breaks the routes in
  `src/App.jsx` because the imports resolve through these shims.
- **Not** safe to "consolidate." The shims exist so smoke tests and the
  Vite/SWC build can assert on contract exports without dragging the entire
  page implementation through every check.

## When you're touching a page

1. To change page behavior, edit the corresponding file under
   `app-modules/pages/` or `app-modules/source/pages/`. Not the shim.
2. To add a new contract that should be asserted by smoke tests, edit the
   shim in `src/pages/`.
3. To add a brand-new route, create both files: a shim in `src/pages/` and
   the real implementation in `app-modules/pages/`.

## Why this convention exists

`app-modules/` houses the page implementations as a "fat" module surface that
can be replaced with prebuilt artifacts when needed. The `src/pages/` shim is
the contract layer the rest of the app depends on, and the place QA-level
assertions hang off. Splitting the surfaces this way keeps page bodies out of
the contract layer (so smoke tests don't re-bundle a 6,500-line page) and
keeps the route table in `src/App.jsx` aligned with a single deterministic
shim per route.
