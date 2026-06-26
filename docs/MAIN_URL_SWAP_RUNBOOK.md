# Main-URL Swap Runbook — snooches.avalonvitality.co → avalonvitality.co

This runbook covers promoting the snooches build to take over the root `avalonvitality.co` and `www.avalonvitality.co` URLs.

**Hard rule from `CLAUDE.md`:** never run `vercel deploy --prod`. The swap is performed by re-aliasing an already-built preview deployment. See `avalon-never-touch-prod-domain` memory.

---

## 0. Pre-flight checklist (must all be true)

- [ ] **GL-003..GL-011** rows in `docs/GO_LIVE_STATUS.md` show `verified` with evidence pointers in `.context/drills/`.
- [ ] **GL-012 BAAs** signed: Supabase (Team + HIPAA add-on), Acuity (Powerhouse/Premium in-app link), Vercel (Pro click-through), Sentry (Business → Legal & Compliance). Resend + Attio BAA decisions resolved (Attio sync stays off until then; `ATTIO_SYNC_ENABLED=false`).
- [ ] **GL-014 key rotation** complete in provider dashboards. Confirm no `sk_live_*`, `sb_secret_*`, or `re_*` prefixes leaked into browser bundles — `npm run test:launch-blockers` enforces this.
- [ ] **GL-018** `npm run verify:prod` green against Production env.
- [ ] **Working tree clean**, branch frozen, last `test:release` run green within 24h.
- [ ] **MFA limitation acknowledged** (GL-013 deferred for v1) — disclose in ops runbook.
- [ ] **v1 limitations disclosed** in ops runbook: GL-016 (Acuity reverse webhook → manual reconciliation), GL-017 (plan recurrence 6-month cap).

If any item is unchecked, **stop**. The flip is one-way for SEO and brand purposes; partial coverage is not acceptable.

---

## 1. Backup state

Before any alias change, record current targets so rollback is mechanical.

```bash
# Capture current alias targets — write to .context (gitignored).
mkdir -p .context/swap-$(date +%F)
vercel alias ls | tee .context/swap-$(date +%F)/before-aliases.txt
vercel inspect avalonvitality.co | tee .context/swap-$(date +%F)/avalonvitality-co-before.txt
vercel inspect www.avalonvitality.co | tee .context/swap-$(date +%F)/www-avalonvitality-co-before.txt
vercel inspect snooches.avalonvitality.co | tee .context/swap-$(date +%F)/snooches-before.txt
```

Confirm:
- `.context/coming-soon-main` is intact — that is the rollback source if anything goes sideways during the swap window.
- The current `avalonvitality.co` target is the coming-soon build (not already something else).
- The current `snooches.avalonvitality.co` target is the build you intend to promote.

---

## 2. Update `PUBLIC_SITE_URL` in Production env

Before re-aliasing, set `PUBLIC_SITE_URL=https://www.avalonvitality.co` (or `https://avalonvitality.co` — match the canonical you want emitted) in **Production** scope only.

```bash
vercel env rm PUBLIC_SITE_URL production    # if it currently points at snooches
vercel env add PUBLIC_SITE_URL production   # enter https://www.avalonvitality.co
```

Reasons:
- `api/create-checkout-session.js`, `api/admin/team/{invite,resend,reset-password}.js`, `api/charge-balance.js`, `api/_booking-email.js`, `api/_welcome-email.js`, and `api/integrations/acuity/webhook.js` all build outgoing email/SMS links from `PUBLIC_SITE_URL`. After the swap, those links must point at the new URL.
- `SEO_BASE_URL` (`app-modules/source/data/seoArchitecture.js`) is already hard-coded to `https://www.avalonvitality.co`. Canonical URLs and JSON-LD `url:` fields are correct as-is — no code change needed.

After updating, **rebuild the preview** so the new env is baked into the bundle:

```bash
npm run exam:snooches    # production exam runs first
# then rebuild + alias to snooches as a staging confirmation
```

---

## 3. The flip

Build the preview, point it at snooches first to confirm runtime, then re-alias the same preview to the root domains.

```bash
# 3a. Build a fresh preview (snooches alias is the staging target).
npm run deploy:snooches
# This pushes the branch, Vercel builds Preview, then aliases the new preview URL to
# snooches.avalonvitality.co. The deployment URL is printed at the end — save it.
DEPLOY_URL="<the avalonweb-XXXX-joseph-8775s-projects.vercel.app URL printed above>"

# 3b. Verify the snooches alias serves the new build cleanly.
npm run verify:hosted-admin-endpoints
# Also: open https://snooches.avalonvitality.co in a browser, confirm post-deploy headers
# (CSP/HSTS/X-Robots-Tag noindex), confirm /book and /subscription render.

# 3c. RE-ALIAS THE SAME PREVIEW to the root domains. Do NOT --prod.
vercel alias set "$DEPLOY_URL" avalonvitality.co
vercel alias set "$DEPLOY_URL" www.avalonvitality.co
```

The `vercel alias set` calls are atomic — Vercel updates the alias record, then DNS propagation takes seconds to minutes.

**Note on the noindex flip:** the new alias is `avalonvitality.co`, not `snooches.avalonvitality.co`. All four host-gated noindex paths return false on the new host and emit indexable robots automatically:
- `vercel.json` host header rule (`X-Robots-Tag: noindex` only when host = snooches).
- `public/snooches-noindex.js` (meta robots only when location.hostname = snooches).
- `api/robots.js` (private-beta robots.txt only when host = snooches).
- `src/lib/seo.js` `useSeo()` (noindex meta only when hostname = snooches).

No code change is required to flip from private-beta to indexed. **However:** this also means `snooches.avalonvitality.co` will continue to serve the same build as `avalonvitality.co` (same alias target) but with noindex headers. That's fine — it stays as a regression target. If you want snooches to point at a frozen older build instead, alias it separately after step 3c.

---

## 4. Post-flip verification

Run, in this order, and stash output in `.context/swap-<date>/`.

```bash
# DNS / alias confirmation
vercel inspect avalonvitality.co
vercel inspect www.avalonvitality.co

# Header / robots check (should NOT be noindex)
curl -sI https://www.avalonvitality.co/ | grep -iE 'robots|csp|content-security|strict-transport'
curl -sI https://avalonvitality.co/ | grep -iE 'robots|csp|content-security'

# Robots.txt should be the public policy, not private-beta
curl -s https://www.avalonvitality.co/robots.txt
# Expect "User-agent: * / Allow: / / Disallow: /api/ ..." NOT "Disallow: /"

# Hosted endpoint regression
API_BASE_URL=https://www.avalonvitality.co npm run verify:hosted-admin-endpoints

# Stability and mobile
PUBLIC_SITE_URL=https://www.avalonvitality.co npm run test:stability
PUBLIC_SITE_URL=https://www.avalonvitality.co npm run test:mobile

# iOS Safari render of /, /book, /subscription (Simulator capture)
# Save to .context/swap-<date>/ios-*.png — same pattern as 2026-06-18 evidence.

# Booking flow: real $1 test card through /book end-to-end
# Confirm appointment created in Acuity AND a real charge in Stripe Test mode
# (or the existing test-card flow if production is on a verified BAA-signed test path).
```

Acceptance bar:
- `test:stability` passes at the same coverage that snooches passed on 2026-06-18 (18/18 routes).
- `test:mobile` 290/290.
- `verify:hosted-admin-endpoints` 401 unauth + 405 GET on retry endpoint.
- robots.txt is public policy; X-Robots-Tag is absent from response headers.

---

## 5. Rollback

If post-flip verification fails, rollback by re-aliasing back to the coming-soon preview.

The coming-soon build is at `.context/coming-soon-main` (per `avalon-never-touch-prod-domain` memory). Identify the original preview URL from `.context/swap-<date>/avalonvitality-co-before.txt` (captured in Step 1).

```bash
# Use the URL captured in Step 1's avalonvitality-co-before.txt
PRIOR_URL="<the previous preview deployment URL>"

vercel alias set "$PRIOR_URL" avalonvitality.co
vercel alias set "$PRIOR_URL" www.avalonvitality.co
```

After rollback:
- Set `PUBLIC_SITE_URL` back to `https://snooches.avalonvitality.co` in Production env.
- Rebuild snooches preview so the env change is reflected: `npm run deploy:snooches`.
- File an incident note in `docs/` describing the failure mode that triggered rollback.

---

## 6. Operational follow-ups (post-flip, within 24h)

- [ ] Confirm `PUBLIC_SITE_URL` value in Production env points at the new URL (sanity check).
- [ ] Re-send a test welcome email and confirm the link points at `www.avalonvitality.co`, not snooches.
- [ ] Re-send a test booking confirmation SMS and confirm the appointment-summary link points at the new URL.
- [ ] Update `api/address-search.js` and `api/reverse-geocode.js` User-Agent + Referer strings to reference `www.avalonvitality.co` (currently snooches — cosmetic but worth doing).
- [ ] Decide whether `snooches.avalonvitality.co` continues to serve the same build (as a regression target with noindex) or is retired. If retired, also retire `verify:hosted-admin-endpoints` snooches default and `scripts/snooches-production-exam.mjs`.

---

## 7. SEO and brand notes

- **Canonical URLs:** `SEO_BASE_URL = https://www.avalonvitality.co` in `app-modules/source/data/seoArchitecture.js`. Already correct. JSON-LD `url:`, `mainEntityOfPage`, and `og:url` fields will all match the new host automatically.
- **Sitemap:** `dist/sitemap.xml` is generated at build time from `SEO_BASE_URL`. After the rebuild in Step 3a, sitemap entries already point at `www.avalonvitality.co`.
- **Title tags / meta description:** managed by `useSeo()` on a per-route basis. No change required.
- **`OG:image`:** confirm the base OG image is hosted at a URL that does not point at snooches.
- **Google Search Console:** add `avalonvitality.co` and `www.avalonvitality.co` as verified properties (DNS TXT or HTML file) before flipping. Submit `sitemap.xml`.
- **301 from snooches:** if you decide to retire `snooches.avalonvitality.co` permanently, add a redirect rule in `vercel.json` `redirects` block (separate from rewrites) to 301 snooches paths → `www.avalonvitality.co/$path`. Don't do this in the same flip window — wait for verification to settle first.

---

## 8. v1 limitations to disclose in ops runbook

- **GL-013 — MFA deferred:** admin/staff accounts do not yet require MFA or passkey policy. Document password hygiene expectations and rotate admin credentials on a calendar cadence until MFA lands post-v1.
- **GL-016 — Acuity reverse webhook unverified:** appointments cancelled/rescheduled from the Acuity side will NOT auto-reconcile with the app. Ops must monitor Acuity and update internal records manually until the webhook is verified.
- **GL-017 — Plan recurrence 6-month cap:** plan appointments are prebooked inline for 6 months. Annual auto-extension past month 6 requires a scheduled job that has not shipped. Ops must manually trigger rebooking for plan members reaching month 6 until the job lands.

---

## 9. Link audit results (snapshot from 2026-06-26)

A repo-wide grep for `snooches.avalonvitality` returned 14 hits in production code. Classification:

| File | Hits | Action |
|---|---|---|
| `vercel.json` | 1 | Leave — host-gated noindex rule, correct as-is. |
| `public/snooches-noindex.js` | 1 | Leave — host-gated noindex helper, correct as-is. |
| `api/robots.js` | 1 | Leave — host-gated private-beta robots.txt, correct as-is. |
| `src/lib/seo.js` | 1 | Leave — host-gated noindex meta, correct as-is. |
| `api/integrations/acuity/webhook.js:378` | 1 | Leave — fallback when `PUBLIC_SITE_URL` unset. Production env always sets `PUBLIC_SITE_URL`, so this never fires; fallback to snooches is acceptable as a defensive default. |
| `api/address-search.js` | 2 | Update to main URL post-flip (cosmetic — Nominatim User-Agent + Referer). |
| `api/reverse-geocode.js` | 2 | Update to main URL post-flip (cosmetic — Nominatim User-Agent + Referer). |
| `scripts/verify-hosted-admin-endpoints.mjs` | 1 | Leave — env-overridable, snooches-scoped by design as a regression target. |
| `scripts/verify-team-invite.mjs` | 1 | Leave — env-overridable, snooches-scoped by design. |
| `scripts/snooches-production-exam.mjs` | 1 | Leave — snooches-scoped by design. |
| `scripts/verify-password-reset.mjs:19` | 1 | Leave — env-overridable via `PASSWORD_RESET_REDIRECT_TO`. |
| `scripts/snooches-safe-deploy.mjs` | 2 | Leave — this IS the snooches deploy script. |

Net: **no production-blocking link changes required for the flip.** The two cosmetic User-Agent strings in `api/address-search.js` and `api/reverse-geocode.js` are tracked in Step 6 follow-ups.

---

## 10. Sign-off

Tag this runbook execution in the GO_LIVE_STATUS ledger as the new launch date row. Capture all `.context/swap-<date>/` artifacts in a commit before merging.
