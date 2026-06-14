# Avalon Vitality — Enterprise Readiness Plan

**Audience:** an autonomous coding agent (Claude Opus 4.8, Codex CLI, or equivalent) with full repo access.
**Mission:** audit, fix, and test this local build in a loop until every exit criterion below passes. Then produce a ship-readiness report. San Francisco launch is summer 2026 — the bar is "a stranger can find the site, book, pay, and log in without anything breaking, and nothing sensitive leaks."

**Launch scope: IV therapy — the base protocol.** Everything in this loop serves the IV launch. Other protocols (supplements, peptides, HRT/sex/hair/aesthetics, with white-glove / in-person / mail fulfillment) are slated to follow **this same summer once the details are figured out** — but they are **parked context, not work items**; see §10. The obligation they create now is only: don't slam those doors shut while fixing IV. HIPAA, however, is in scope *now* — IV bookings already touch client health data (track J).

This playbook is self-contained: a fresh agent given only this file and the repo can start at Phase 0 without asking questions. All commands referenced are verified to exist in `package.json`.

---

## 1. Definition of enterprise-ready (exit criteria)

The loop is done **only when all of these hold simultaneously**:

| # | Gate | How to verify |
|---|------|---------------|
| 1 | Full release gate green | `npm run test:release` exits 0 (runs lint, typecheck, all static QA, build, perf, smoke, lifecycle, kernel, preapi, day, then boots preview on :4173 and runs booking/login/interaction/mobile/stability/visual/translate QA) |
| 2 | Strict typecheck clean | `npm run typecheck:strict` exits 0 |
| 3 | Quick scorecard green | `npm run test:scorecard` exits 0 (performance, accessibility, code-quality, design-system, analytics) |
| 4 | Zero open P0/P1 findings | Findings table in `.context/enterprise-audit-log.md` shows every P0/P1 as `fixed` or `waived` (waivers require a written reason and only the user can approve a P0 waiver) |
| 5 | Revenue path verified in a real browser | On `npm run preview` (:4173): home → goal select → `/book` → configure therapy + dose → `/checkout` → Stripe embedded checkout step reached — on desktop **and** 390px mobile viewport |
| 6 | All three roles log in | Demo mode on :4173 with the demo password: ADMIN001, CLIENT001, NURSE001 each reach their dashboard. **The role model is ADMIN / CLIENT / NURSE only** — NP/MD/PHYSICIAN are not launching; good-faith-exam (GFE) flows fold into the nurse role |
| 7 | Launch-blocker checklist resolved | Every item in §7 is done or explicitly deferred by the user |
| 8 | Revenue path green across the environment matrix | `npm run test:revenue-matrix` (track I, once built) passes in Chrome, WebKit/Safari mobile, Android profile, and Instagram/TikTok/Facebook in-app webview UAs |
| 9 | No customer-visible content shipped without approval | "Recommended fixes — awaiting final approval" queue in the audit log is empty or every shipped item references Joseph's approval |

If any gate fails → return to the failing audit track in §4 and continue the loop. Never declare done with a failing gate.

---

## 2. Non-negotiable guardrails

Learned from production incidents. A fix that violates any of these is wrong regardless of what a QA script says — revert it.

1. **No caching service worker.** The current SW is a kill-switch. A cache-first SW previously crashed the live site after deploys (stale chunks). Do not reintroduce one.
2. **`.av-page-stage` must stay free of `transform`, `filter`, and `will-change`.** Any of these makes it the containing block for `position: fixed` and silently breaks the navbar and store links after scroll. `npm run test:navfix` guards this — run it after any CSS/layout change.
3. **Preserve dual-mode auth.** `src/lib/useAuthStore.js` + `src/lib/preApiSecurity.js` implement Supabase auth with a demo-roster fallback. Demo mode must keep working on localhost/192.168.\*/snooches.avalonvitality.co, and must remain impossible on `avalonvitality.co` (`isDemoAuthAllowed()`).
4. **Credential boundary.** Configure everything *around* secrets, but never write or commit secret values. When a key must be rotated or an env var set in Vercel/Supabase, add it to the "user actions" section of the audit log for Joseph to paste himself.
5. **Design system stays.** Dark + Bebas Neue aesthetic, night-theme `#fff` text overrides, AA-safe grey tiers. Polish what exists; do not introduce a new design system or restyle pages wholesale. `npm run test:design-system` is the arbiter.
6. **ES2015 build target stays** (Instagram/TikTok in-app webview compatibility).
7. **One finding per commit.** Atomic `fix(scope): …` commits so anything can be reverted alone.

---

## 3. Phase 0 — Baseline (every run starts here)

Capture state before touching anything, so every fix has before/after proof.

```bash
npm ci                      # only if node_modules is missing/stale
npm run build               # must succeed before anything else
npm run test:scorecard      # quick 5-dimension gate
npm run test:smoke          # route/catalog integrity
```

Record results in `.context/enterprise-audit-log.md` (create if absent) with this shape:

```markdown
# Enterprise audit log
## Run YYYY-MM-DD HH:MM
### Baseline
- build: pass/fail
- scorecard: performance ✅/❌, accessibility ✅/❌, code-quality ✅/❌, design-system ✅/❌, analytics ✅/❌
- smoke: pass/fail
### Findings
| ID | Sev | Track | Finding | File(s) | Status (open/fixed/waived) | Commit |
### User actions required
- [ ] (keys to rotate, env vars to paste — never values, just names + where)
```

This log is the loop's persistent state — any later agent/session resumes from it instead of re-auditing from scratch.

If the baseline build itself fails, fixing the build is automatically the first P0.

---

## 4. Phase 1 — Audit tracks

Work tracks in priority order (A→H). For each: run the listed checks, file findings into the log with severity (P0 = blocks launch / data risk, P1 = degrades core flows, P2 = quality, P3 = polish).

### A. Security & secrets — P0 track
- `npm run test:security` (hard-wall QA), `npm run test:privacy`, `npm run test:compliance`, `npm audit --omit=dev`.
- **Known finding to confirm and log:** `ACUITY_API_KEY` is present in `.env.local`. Verify it is gitignored and never bundled (grep `dist/` for the key prefix after a build). Either way, it has been exposed in tooling output → add "rotate Acuity API key" to user actions.
- **Known item:** the Gemini image-MCP key was exposed in chat earlier → keep "rotate Gemini key" on the user-actions list until Joseph confirms.
- Verify demo auth cannot activate on the production host: read `isDemoAuthAllowed()` in `src/lib/preApiSecurity.js`; confirm host allowlist and that `VITE_AVALON_ENABLE_LIVE_API=true` disables it.
- Review CSP/headers in `vercel.json`: no wildcard origins beyond what Stripe/Supabase/Acuity need; HSTS, nosniff, frame-deny intact; snooches stays `noindex`.
- Grep `src/` for any hardcoded keys, tokens, or emails that shouldn't ship.

### B. Auth go-live — P0 track
- Follow `docs/AUTH_SETUP.md`. Confirm `supabase/migrations/007_auth_profile_trigger.sql` matches what the code expects (`public.profiles.role`), and document remaining manual Supabase steps (env vars, redirect URLs) as user actions.
- **Role consolidation (decided):** launch roles are ADMIN / CLIENT / NURSE only. Fold GFE (good-faith exam) flows into the nurse role; deprecate NP/MD/PHYSICIAN in the demo roster, route guards, and provider pages (hide or alias to nurse — don't leave dead role paths reachable). Update `login-qa.mjs` expectations to match.
- `npm run test:login` against :4173 — all three demo roles.
- Passkey flow: COOP header must stay passkey-safe (recent commit `731ff14` fixed this — don't regress it).
- `mfa: 'placeholder'` in `src/lib/useAuthStore.js` — implement or file as a consciously deferred P1 with user sign-off.

### C. Revenue path — P0 track
- `npm run test:booking`, `npm run test:lifecycle`, `npm run test:paymentmethods`.
- Verify `acuityTypeForCart()` (`src/lib/acuityAppointmentTypes.js`) maps **every** therapy/dose combination — the recent dose-variant dropdown work (`c6ee574`, `893b000`) changed cart shapes; orphaned mappings are exactly the kind of silent revenue bug this track exists for.
- Stripe: embedded checkout must lazy-load only at the payment step (keep ~236 KiB off other pages); confirm `loadStripe` import stays in `@stripe/stripe-js/pure`.
- Manual browser pass of exit criterion #5 (desktop + 390px).

### D. Reliability — P1 track
- Wire Sentry (or equivalent) into `src/components/ErrorBoundary.jsx` — the code already says "When Sentry is added post-launch, pipe componentDidCatch into Sentry.captureException." DSN goes in env (user action), code goes in now, no-ops when DSN absent.
- Verify 404 page, route fallbacks (`RouteFallback`), and that `npm run test:stability` passes.
- `npm run test:navfix` — fixed-navbar regression guard.

### E. Performance — P1 track
- `npm run test:performance`, `npm run assets:audit`.
- `public/bags/` is ~35MB — run `npm run assets:optimize`, confirm lazy-loading of bag imagery, and log anything above budget.
- BookNow chunk (~157KB) — look for cheap wins (defer non-critical imports) but do not restructure the page for marginal gains.
- `npm run test:mobile` for mobile-specific weight/UX issues.

### F. Accessibility & visual fidelity — P1 track
- `npm run test:accessibility` plus a manual keyboard-only pass of home → book → checkout and the login modal.
- Contrast must hold against the AA-safe grey tiers; flag any new text colors outside the tier system.
- `prefers-reduced-motion` must still disable the heavy transitions (red-carpet overlay etc.).
- **Pixel-perfect across devices:** `npm run test:visual` plus screenshot passes at the track-I matrix viewports (desktop, iPhone 390px, Android, in-app webview widths) on the key pages (home, /book, /checkout, pricing, login, member dashboard). File any layout break, overflow, clipped text, misaligned glass surface, or font fallback as a finding with the screenshot. The bar is "no display issues on any device" — a page that works but renders ugly in an Instagram webview is a finding, not a pass.

### G. SEO — P2 track
- `robots.txt` is served via the `/api/robots` rewrite in `vercel.json` — verify the endpoint output is correct for both hosts (indexable on avalonvitality.co, noindex on snooches). Don't add a duplicate static file unless the endpoint is broken.
- Per-page OG images: top routes all fall back to `og-homepage.jpg`. Generate/assign OG images for the top ~6 routes (/book, /pricing, key therapy pages). Image generation is available via the gemini-image MCP if needed.
- Sitemap (`public/sitemap.xml`) must match `src/routes/routeGroups.js` — no dead or missing URLs. `npm run test:smoke` already cross-checks routes against `App.jsx`.

### H. Code quality — P2 track
- `npm run lint`, `npm run typecheck`, `npm run test:code-quality`.
- ESLint/jsconfig only cover `src/components` + `src/pages`; `src/lib` (52 files, includes auth and booking logic) is unchecked. Expand coverage incrementally — one directory at a time, fixing what surfaces, never loosening rules to pass.
- Glass-system violations per `.context/glass-system-audit-2026-06-02.md`: BookNow.jsx (74 hand-built surfaces), Command.jsx (148). Migrate to the shared glass components opportunistically — P2, behind everything above.

### I. Revenue-loss detection across browsers & devices — P0 track (Mimetic parity)
The reference bar is trymimetic.com: scan the revenue path across every environment customers actually use, find the gaps losing money, attach a dollar figure, generate fixes for review, and keep monitoring after launch. The existing harness (`booking-flow-qa.mjs`) already drives real Chrome over CDP at a 390×844 mobile viewport — extend it, don't replace it.

1. **Environment matrix.** Build `scripts/revenue-matrix-qa.mjs` (wire as `npm run test:revenue-matrix`), following the existing harness conventions (BASE_URL env var, real browser, nonzero exit on failure). Run the full revenue path — home → goal select → `/book` → therapy + dose select → `/checkout` → Stripe embedded checkout mounts — in each of:
   - Desktop Chrome (already covered — reuse)
   - Desktop Safari + iPhone Safari device profile — add **Playwright (webkit)** as a devDependency; CDP-Chrome cannot emulate WebKit, and Safari Mobile is exactly where competitor scanners find broken checkouts
   - Android Chrome profile
   - **Instagram, TikTok, and Facebook in-app webview user agents** at mobile viewport — this site's traffic will come from social; the ES2015 build target exists for these webviews, so test them, don't just build for them
   Each environment asserts: add-to-cart/dose select responds, sticky book bar visible and tappable, no console errors, Stripe iframe mounts.
2. **Revenue-at-risk scoring.** Every finding on the revenue path gets a `$ at risk/mo` estimate in the audit log: (sessions affected by environment/step, from analytics) × (booking conversion rate) × (average order value from `src/data/catalog.js` pricing). When traffic data doesn't exist yet (pre-launch), use stated assumptions and label them. Sort the fix queue by dollars, not by severity alone.
3. **Funnel instrumentation.** Verify analytics events fire at every funnel step (goal select, dose select, checkout start, payment step) in every matrix environment — a step that converts but doesn't report is a marketing↔engineering gap, which is precisely the class of bug this track exists to catch. `npm run test:analytics` covers static wiring; the matrix run covers live firing.
4. **Continuous monitoring (post-deploy).** After each production deploy: run the matrix against the live host, watch console errors and funnel events, compare conversion-step success against the pre-deploy baseline, alert on regression. The `/canary` skill or a scheduled agent run covers this; record results in the audit log so trends are visible.
5. **Fix-and-prove loop.** After any revenue-path fix ships, re-run the matrix and record the before/after step-success delta next to the finding — the "conversion after fix" proof, not just "test passes now."

### J. HIPAA & clinical-data safety — P0 track
The Rx roadmap (peptides, HRT) makes this non-optional. Current scripts `test:privacy`, `test:compliance`, `test:security` are the floor, not the ceiling.

1. **PHI inventory & data-flow map.** Document every place client health data is collected, stored, or transmitted: booking intake, GFE/clinical clearance, member dashboard, admin/nurse views, Supabase tables, Acuity appointments, Resend emails, Stripe metadata. Write the map into the audit log; it is the basis for everything below.
2. **No PHI in third-party exhaust.** Audit that analytics events (`src/lib/analytics.js`), console logs, error reports, and URLs never carry health data, names tied to treatments, or appointment details. **Constraint on the Sentry work (track D): scrub/deny-list PHI before any event leaves the browser** — error tracking that exfiltrates PHI is worse than none.
3. **Access control by role.** Verify minimum-necessary access: CLIENT sees only their own records; NURSE sees only assigned clients' clinical data; ADMIN access to clinical detail is deliberate, not incidental. Audit Supabase RLS policies (or document their absence as a P0 finding) — client data must be row-level secured, not just route-guarded in the SPA (route guards are cosmetic; RLS is the real wall).
4. **Auditability & sessions.** Admin/nurse actions on client records should be loggable; sessions must expire; verify logout actually clears state.
5. **BAA checklist (user actions).** Every vendor touching PHI needs a signed BAA before real client health data flows: Supabase, Acuity, Resend, Sentry (once added), hosting if PHI transits it. The agent maintains the list; Joseph signs.
6. **Public claims & notices.** `/hipaa-notice`, privacy policy, and compliance copy (`test:compliance`) must match actual practice — never claim more than the implementation delivers.

### K. Extensibility hygiene — P2 track (rules, not work items)
No building for future verticals in this loop. Just don't close doors while fixing IV:

- **Alias, don't delete.** The NP/MD/PHYSICIAN deprecation (ENT-004) hides those roles; keep the role plumbing in `useAuthStore.js` and route guards intact — Rx protocols will need prescriber roles back, possibly this summer.
- **Keep the pre-API contract pattern.** "Brain/Engine" modules + `src/contracts/preApiContracts.ts` model unbuilt integrations as explicit `local_placeholder` states (`test:preapi` guards it). Any fix touching them preserves the pattern.
- **If `catalog.js` gets split anyway** (ENT-003), don't bake IV-only assumptions into the cart/checkout/handoff shape — leave room for a product `type` and `fulfillment` dimension. Don't add those dimensions now.
- **New lib code enters lint + typecheck coverage from day one.**

---

## 5. Phase 2 — Fix loop protocol

**Two lanes — know which one a finding is in before touching it:**

- **Code lane (agent ships):** mechanical/engineering fixes — broken flows, regressions, performance, a11y, lint/type issues. The agent fixes, verifies, and commits per the steps below; the diff itself is the reviewable artifact.
- **Approval lane (agent recommends, Joseph ships):** anything customer-visible as *content* — copy, pricing, product names/descriptions, brand imagery, legal/compliance wording, therapy claims. The agent does **not** commit these. Instead it writes a recommendation into the **"Recommended fixes — awaiting final approval"** section of `.context/enterprise-audit-log.md` with: current state → proposed change → reason → revenue/risk impact. Joseph approves (or edits) each item; only then does it ship, referencing the approval. ENT-001 (NAD pricing) is the canonical example — the fix is one line, but the price is a business decision.

When in doubt about which lane, it's the approval lane.

1. Sort the findings table P0 → P3, with `$ at risk/mo` (track I) breaking ties. Work strictly in that order.
2. For each finding: fix → re-run the **specific QA script that caught it** → re-run `npm run test:smoke` → commit (`fix(scope): finding ID — description`). Update the log row to `fixed` with the commit hash.
3. If a fix regresses any guardrail (§2) or any previously-green script: `git revert` it. Do not patch forward on top of a regression.
4. After each P0/P1 batch, get an adversarial second opinion on the accumulated diff: `codex review` (Codex CLI) or the `/codex challenge` skill if available. File anything real it finds as new findings.
5. Anything requiring secrets or third-party dashboards goes to "User actions required" — never blocked on, never faked.

---

## 6. Phase 3 — Full regression

When the findings table has no open P0/P1:

```bash
npm run test:release        # the master gate — runs everything incl. browser QA on :4173
npm run typecheck:strict
```

Then a manual browser pass on :4173 (demo password) covering the historically fragile spots:
- Fixed navbar still fixed after deep scroll; store links clickable post-scroll.
- Sticky book bar and toasts behave (regressed before — `731ff14`).
- All three role logins (ADMIN, CLIENT, NURSE) → correct dashboards; NP/MD/PHYSICIAN logins rejected or aliased per the role consolidation.
- Booking E2E on desktop + 390px (exit criterion #5).
- Hard-refresh after a fresh build — no stale-chunk/service-worker ghosts.

Any failure → new finding → back to Phase 2.

---

## 7. Launch-blocker checklist (user actions + final go-live)

The agent maintains this; only Joseph executes the credentialed items:

- [ ] Rotate Acuity API key (exposed in local tooling); set new key in Vercel env, not in any committed file
- [ ] Rotate the Gemini image-MCP key exposed in chat
- [ ] Set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel production env
- [ ] Run Supabase migration `007_auth_profile_trigger.sql`; add production redirect URLs in Supabase Auth config
- [ ] Set `VITE_AVALON_ENABLE_LIVE_API=true` for production (kills demo auth)
- [ ] Set Sentry DSN env var (after track D lands)
- [ ] Confirm Stripe is in live mode with real price IDs
- [ ] MFA decision: implement now or accept deferred-P1
- [ ] Confirm role consolidation shipped: ADMIN/CLIENT/NURSE only, GFE under nurse, NP/MD/PHYSICIAN aliased/hidden (not deleted — see track K)
- [ ] Sign BAAs with every vendor touching client health data before real PHI flows: Supabase, Acuity, Resend, Sentry (once wired), hosting if applicable (track J)

---

## 8. Phase 4 — Ship-readiness report

When all exit criteria pass, append to `.context/enterprise-audit-log.md` and report to the user:

1. **Before/after scorecard** (Phase 0 baseline vs final run).
2. **Findings summary**: count fixed per track, list of waivers with reasons.
3. **Outstanding user actions** (§7 unchecked items) — the only things between the repo and launch.
4. **Commit list** for the run (`git log --oneline` since baseline).

---

## 9. Agent execution notes

**Running with Claude (Opus 4.8):** point a session at this file ("execute docs/ENTERPRISE_READINESS_PLAN.md"). Work autonomously through Phases 0→4; commit per fix; only stop for §7 user actions or P0 waiver decisions.

**Running with Codex CLI:** same entry point; use `codex review` as the Phase 2 step-4 adversary even when Codex is also the fixer (fresh session = fresh eyes).

**State between runs:** `.context/enterprise-audit-log.md` is the single source of truth — findings, waivers, scores, user actions. A resuming agent reads it first, re-runs Phase 0 to confirm reality still matches, then continues from the first open finding. (`.context/` is gitignored; the log is workspace-local by design.)

**Time-boxing:** `test:release` is the expensive gate — use it at Phase 3 and final verification, not after every fix. Per-fix verification = the specific script + `test:smoke`.

---

## 10. Appendix — parked protocols (context only, no work in this loop)

IV is the base protocol. These follow later this summer once Joseph figures out the details. Recorded here only so fixes don't foreclose them (track K rules); **do not design, scaffold, or build for these in this loop**:

- **Supplement store** — drop-ship physical goods.
- **Prescription peptides** and **HRT / sexual health / hair / aesthetics** — require prescriber roles (why NP/MD code is aliased, not deleted), GFE/telehealth workflow (already folded into nurse), and pharmacy-partner integrations. Full-strength HIPAA posture (track J) is the prerequisite being built now.
- **Fulfillment modes** — white-glove delivery with instructionals, in-person nurse service, or straight mail-order. Future catalog/cart work gets a `fulfillment` dimension; today's only rule is not to hardcode "in-person IV appointment" assumptions deeper than they already are.

When Joseph green-lights a protocol, it gets its own plan; this playbook's job is only to make the base rock-solid.
