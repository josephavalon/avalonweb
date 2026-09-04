# Cognito Front Door

**Status:** shipped on `snooches.avalonvitality.co`. **BAA NOT SIGNED — synthetic data only.**
**Owner doc for:** why intake moved into a Cognito Forms iframe, and every mechanism that keeps the front door PHI-free.
**Related:** `docs/PHI_DATA_FLOW.md` (inventory), `docs/GO_LIVE_STATUS.md` (GL-019, GL-020).

---

## 1. The problem this solves

Avalon's v1 front door is a brochure. It has one job that touches a patient:
collect enough to call them back. The moment a patient's name or mobile number
lands in Avalon's own DOM, three things follow:

1. Supabase, Vercel, and every vendor in the request path enter HIPAA BAA
   scope. Supabase's HIPAA add-on alone is ~$950/mo.
2. Every browser extension, every analytics snippet, and every error reporter
   loaded on that page can read the field values. A Sentry breadcrumb of a
   keystroke is a disclosure.
3. Every future page we add has to be audited for the same leak.

The fix is not "sanitize harder." It is to make the PHI **never enter Avalon's
document in the first place**. Intake happens inside an iframe owned by
`cognitoforms.com`, on their HIPAA plan, under their BAA. Cross-origin
isolation — not our own discipline — is the control.

### Live identifiers

| Thing | Value |
|---|---|
| Cognito account key | `Tj34pIQDwkyKMQlnT_qpRQ` |
| Form number | `1` (the account form NUMBER, not a name or GUID) |
| Iframe URL | `https://www.cognitoforms.com/f/Tj34pIQDwkyKMQlnT_qpRQ/1` |
| Build-time env | `VITE_COGNITO_ACCOUNT_KEY`, `VITE_COGNITO_INTAKE_FORM_ID` (see `.env.example`) |
| Front-door host | `snooches.avalonvitality.co` |
| Component | `src/components/forms/CognitoFormEmbed.jsx` |

Required Cognito-side configuration, all of which must be verified before real
patients are routed here:

- **HIPAA Enterprise plan** (the only tier where Cognito will sign a BAA)
- **Entry encryption ON**
- **Every field marked Protected**
- **BAA signed and countersigned** — *pending as of 2026-07-30*

Until the BAA is countersigned, the form is live but must take **synthetic data
only**. Do not link a real patient to it, and do not run a marketing campaign
into `/start`.

---

## 2. Why the iframe embed and NOT `seamless.js`

Cognito publishes three embed modes. Only one of them is acceptable here.

| Mode | What it does | Verdict |
|---|---|---|
| **iframe** | Renders the form in a document on `cognitoforms.com` | **This is what we ship.** |
| `seamless.js` | Injects Cognito's form markup **into the host page's DOM** so it inherits host CSS | **Banned.** |
| Self-hosted / API | We render fields, we POST to Cognito | **Banned.** |

`seamless.js` is the tempting one, because it makes the form inherit our
typography and spacing for free. It is also the one that defeats the entire
architecture: the `<input>` elements it creates are **our document's** input
elements. `document.querySelector('input').value` returns the patient's name.
Every extension, every analytics script, every `window.onerror` handler on the
page can read it. Supabase and Vercel go straight back into BAA scope and the
~$950/mo bill comes back with them.

The self-hosted/API mode is worse still — then we're also the ones handling the
transport.

`scripts/front-door-qa.mjs` enforces this mechanically: `CognitoFormEmbed.jsx`
must match no `<input`, `<textarea`, or `<select`, must not contain the strings
`full_name`, `mobile_number`, `seamless.js`, or `data-cognito-placeholder`, and
must contain `<iframe` and `cognitoforms.com/f/`. If someone "upgrades" the
embed for styling reasons, the launch gate fails.

**Accepted cost:** the form does not inherit Avalon's design system. It is
styled inside Cognito's own theme editor instead. That is the price of the
origin boundary, and it is cheap.

---

## 3. Why a fixed height and NOT Cognito's `iframe.js` resizer

Cognito ships a small `iframe.js` that listens for `postMessage` height updates
and grows the frame so the page scrolls instead of the frame. We do not use it,
for two independent reasons — either one alone is disqualifying:

1. **It is third-party JavaScript executing in Avalon's document.** The whole
   premise of this component is that no vendor code runs on our origin. A
   resizer is a small script today and a supply-chain surface forever; it sits
   on the same page as the frame it is measuring, and a compromised version of
   it can reach into the page.
2. **Our CSP has no `script-src https://www.cognitoforms.com`, deliberately.**
   So the resizer would be blocked at load, silently, and the frame would sit at
   its default height anyway. Adding the origin to `script-src` to "fix" that
   would undo reason 1.

Instead the frame is a fixed 760px (640px in `compact`/`tight` layouts) with
`scrolling="yes"`. A long form scrolls *inside* the frame rather than growing
the page.

**Accepted cost:** a nested scroll region on small viewports. Tolerable because
the intake is deliberately short (name + mobile — see the "START form locked
floor" rule: layer context *around* that floor, never add fields to it).

---

## 4. The fail-closed fallback

`CognitoFormEmbed` renders the iframe only when **both** `accountKey` and
`formId` resolve. When either is missing — an unprovisioned preview build, a
missing Vercel env var — it renders a static card with a phone number:

> Form failed to load. Please refresh, or reach us at (415) 980-7708.

It does **not** render a "temporary" name/phone form of our own. That exact
shortcut is how the landing page ended up collecting PHI in the first place,
and it is the failure mode a rushed engineer will reach for. The component
comment says so at the callsite. If you are here to make the flow testable
without provisioning: don't. Provision the form.

Analytics from the embed is anonymous and propertyless: a single fire-once
`cognito_form_loaded`. There is **no submit event** — observing a submission
would mean reading the frame, and an unreliable funnel number is not worth a
PHI surface. The `message` listener checks `event.origin` and then throws the
message away; `event.data` is never read, never parsed, and never drives UI.

---

## 5. The CSP intersection trap, and the `has`/`missing` design

Vercel does **not** merge `headers` entries. When two entries both match a
request and both set `Content-Security-Policy`, you do not get the union or the
intersection of the policies — you get two headers, and browsers enforce the
**intersection** of all CSP headers present. The practical result is that the
stricter policy wins on every directive, so a second block that omits
`frame-src https://www.cognitoforms.com` silently blocks the intake iframe even
though the first block allows it.

That is the trap. The fix is to make the two blocks **mutually exclusive** so
exactly one CSP header is ever emitted per request:

```jsonc
{ "source": "/(.*)", "has":     [{ "type": "host", "value": "snooches.avalonvitality.co" }], ... }
{ "source": "/(.*)", "missing": [{ "type": "host", "value": "snooches.avalonvitality.co" }], ... }
```

The `missing` block is not optional decoration. Without it, every host that is
*not* the front door would have **no CSP at all**.

Differences between the two policies — there is exactly one:

| Directive | Front-door block (`has`) | Default block (`missing`) |
|---|---|---|
| `frame-src` | includes `https://www.cognitoforms.com` | does not |
| `script-src` | **never** includes `https://www.cognitoforms.com` | **never** includes it |
| `script-src` | JSON-LD `sha256-` hash, no `'unsafe-inline'` | same |

`frame-src` grants the right to *display* the origin in a frame. `script-src`
would grant the right to *execute its code in our document*. Those are the two
sides of the boundary this whole document is about, and conflating them is the
single most likely way to lose it. The guard asserts all of it: exactly two CSP
blocks, one keyed on `has`, one on `missing`, cognitoforms in `frame-src` on the
front-door block only, cognitoforms in **neither** `script-src`, the JSON-LD
hash in both, and `'unsafe-inline'` in neither.

---

## 6. Why BOTH a client gate and a server gate

They defend different attacks and neither is sufficient alone.

**Client gate** — `src/lib/frontDoor.js` + `src/components/FrontDoorRedirect.jsx`.
On a front-door host, `<FrontDoorRedirect>` bounces the route to `/start` before
the wrapped page ever mounts (the host read happens in a `useState` initializer,
so the first render is already correct and the gated page's effects never fire).
This is a **UX** control: it makes sure a real visitor cannot find themselves in
a legacy funnel, and cannot be shown a raw `409` by a page that assumed its API
would answer.

It is worth nothing against an attacker. It is JavaScript, on the client, and
anyone can skip it.

**Server gate** — `blockFrontDoorPhiRoute()` in `api/_lib/pre-api-guard.js`.
Reads the forwarded host and answers `409 front_door_phi_route_disabled` on 25
PHI-writing handlers. This is the **actual** control: it is what makes the
statement "no patient identity reaches Supabase from this host" true, no matter
what a client does. `curl -X POST https://snooches.avalonvitality.co/api/create-checkout-session`
gets a 409.

It is *also* not sufficient alone: without the client gate, a logged-in user on
the front door would mount `/members/account` and watch every panel fail with an
unexplained error. Correct security, terrible product.

### The duplicated host list

`FRONT_DOOR_HOSTS` is defined **twice** — once in `src/lib/frontDoor.js` and
once in `api/_lib/pre-api-guard.js`. This is deliberate, not an oversight. The
client module reads `window` and lives behind the Vite `@/` alias; serverless
functions must not depend on it. The guard script asserts the two lists are
**identical**, so drift fails CI.

### The server gate denies by default (2026-09-01)

The server half no longer asks "is this host on the front-door list?". It asks
"is this host a known OS host?", and gates everything else.

That inversion closed a real hole. Under the old shape, `blockFrontDoorPhiRoute()`
fired only on the three named hosts, so every host nobody had thought to add ran
the PHI funnel wide open — including every `avalonweb-*.vercel.app` preview URL
of this project. Previews have no deployment protection (`GET /` answers `200`)
and Preview env carries `AVALON_ENABLE_LIVE_API`, `STRIPE_SECRET_KEY`,
`ACUITY_API_KEY`, `RESEND_API_KEY` and `QUO_API_KEY`, so anyone who found one
could drive real charges and real bookings against production vendors.
Measured before the fix: `GET /api/create-checkout-session` answered `409` on
`www` and `405` on a preview URL — the guard never ran there.

`OS_HOSTS` in `api/_lib/pre-api-guard.js` is now the allow-list: `beta` and
`care`, plus private/local addresses. Everything else is a front door.

- **Adding a host to `OS_HOSTS` is the dangerous edit now.** It grants a host
  the PHI funnel. `FRONT_DOOR_HOSTS` still wins over it, so the apex can never
  be opened this way.
- **QA against a raw preview URL** is gated like any other unknown host. The
  normal workflow aliases a preview onto `beta.avalonvitality.co` and needs
  nothing extra. If you genuinely need the raw URL, set
  `AVALON_OS_EXTRA_HOSTS` (comma-separated) on that deployment. It is **inert
  when `VERCEL_ENV=production`**, by code, not by convention — a hatch that can
  be left on in prod is just the old bug with extra steps.
- `hostFromRequest()` reads `x-forwarded-host`, which is now the key to the
  gate. Verified 2026-09-01 that Vercel overrides it: `X-Forwarded-Host:
  beta.avalonvitality.co` sent to `www` still answered `409`. **Re-test that
  assumption if this ever moves off Vercel.**

`checkGateDeniesByDefault()` in `scripts/front-door-qa.mjs` calls the real
`isFrontDoorHost()` over an exhaustive host table. The older checks only prove
the host *lists* look right; this one proves the *decision* is right, which is
the thing that was actually wrong.

### The apex tripwire

**Superseded 2026-08-03.** This section used to say neither list may contain
`avalonvitality.co` or `www.avalonvitality.co`, because adding the apex would
have redirected the live revenue funnel into `/start`. That reversed when the
front door *became* the main URL: the apex and `www` now serve the PHI-free
brochure, so both lists must contain them, and
`REQUIRED_FRONT_DOOR_HOSTS` in `scripts/front-door-qa.mjs` asserts their
**presence**. Removing the apex is now the catastrophic edit — it would serve
the full PHI funnel from the live site.

### Wrapping order

Where a route has both wrappers, `<CareAcuityForward>` stays **outermost**:

```jsx
<Route path="/book" element={
  <CareAcuityForward><FrontDoorRedirect><BookNow /></FrontDoorRedirect></CareAcuityForward>
} />
```

On apex/www/care, `CareAcuityForward` returns null and hard-navigates to Acuity
before `FrontDoorRedirect` ever mounts, so apex behavior stays bit-for-bit
unchanged. Invert the nesting and you have changed the live site's behavior
while thinking you were only touching the front door. The guard asserts the
ordering.

---

## 7. Route sweep

### Client-gated routes (`<FrontDoorRedirect>` → `/start`)

| Route | Page | CareAcuityForward outside? | Why it is PHI |
|---|---|---|---|
| `/custom` | CustomProtocol | yes | protocol builder → checkout |
| `/book` | BookNow | yes | full booking funnel: identity, address, DOB |
| `/booking/confirmation` | BookingConfirmation | yes | renders appointment + contact detail |
| `/checkout` | Checkout | yes | identity, address, emergency contact, payment |
| `/checkout/success` | CheckoutSuccess | yes | appointment summary |
| `/signup` | Signup | no | creates a Supabase profile |
| `/order` | ManageOrder | no | looks up an order by contact |
| `/gift` | Gift | no | purchaser + recipient identity |
| `/review` | Review | no | free-text review tied to a visit |
| `/members/account` | members/Account | no | every panel calls a gated `api/me/*` route |

**Deliberately NOT gated:** `/login`. Staff need to sign in on this host, and
credentials are not PHI. Note also that there is no top-level `/account` route —
`/members/account` is the canonical path; `/account/new-password` is a
password-reset landing and collects no PHI.

### Server-gated handlers (`blockFrontDoorPhiRoute` → `409`)

25 handlers, enumerated in `PHI_WRITING_HANDLERS` in `scripts/front-door-qa.mjs`:

`api/acuity-book.js`, `api/charge-balance.js`, `api/checkout/verify.js`,
`api/create-checkout-session.js`, `api/events/{apply,checkout,kiosk,organizer}.js`,
`api/gift-cards/{purchase,redeem}.js`, `api/invite/accept.js`,
`api/manual-booking.js`, `api/me/account/delete-request.js`,
`api/me/billing-portal.js`, `api/me/conversations/create.js`,
`api/me/documents/sign.js`, `api/me/pay-balance.js`,
`api/me/payment-methods.js`, `api/me/profile.js`, `api/me/refund-request.js`,
`api/me/subscription/{cancel,change,pause}.js`, `api/reviews/submit.js`,
`api/support.js`.

`api/support.js` was the late addition (2026-07-30). It looked harmless — a
contact form — but it INSERTs `name`, `email`, and a free-text `message` into
Supabase `support_tickets`. `app-modules/pages/Support.jsx` already renders a
PHI-free contact card on front-door hosts, so the *form* was unreachable, but
the *endpoint* stayed callable directly. Any patient identity landing in
Supabase keeps Supabase in BAA scope, which defeats the whole exercise. The UI
hiding a form is never the gate.

**Deliberately NOT gated:** auth routes, `/api/analytics`, `/api/robots`, cron
jobs, webhook receivers (Stripe/Acuity/Resend must keep delivering on every
host), and `api/admin/*` routes already behind `requireStaff`/`requireAdmin`.

---

## 8. Analytics on the front door

Page-view paths are stripped to the bare pathname. A query string is a health
interest: `/protocols?therapy=NAD` discloses what the visitor is looking for.
`pathOnly()` in `src/lib/analytics.js` strips both `?` and `#`, and it does so
in the analytics layer rather than at callsites — callers must never be the only
line of defense. `document.referrer` is reduced to origin + pathname for the
same reason.

Event names come from the `ANALYTICS_EVENTS` taxonomy only. The guard collects
every `track('...')` string literal across `src/` and `app-modules/` and fails
on any name not in that object, because a free-form event name
(`track('nad_1000_for_jane')`) is exactly how an identifier reaches a
destination with no BAA.

---

## 9. The guard

`scripts/front-door-qa.mjs`, 9 assertion groups, wired **two ways**:

- `npm run test:front-door` — fast local loop
- `checkFrontDoorLockdown()` inside `scripts/launch-blocker-qa.mjs`, imported
  (not shelled out to) so a front-door regression is a real launch-blocker
  failure and `npm run test:launch-blockers` cannot pass without it

Every assertion was verified by deliberately breaking it and confirming a
non-zero exit. A guard nobody has seen fail is not a guard.

---

## 10. Open items

| Item | Status |
|---|---|
| Cognito BAA signed + countersigned | **NOT DONE** — synthetic data only until then |
| Acuity BAA (Powerhouse/Premium in-app link) | pending user action |
| Verify Cognito HIPAA Enterprise plan is active | pending user verification |
| Verify entry encryption ON, all fields Protected | pending user verification |

Tracked as GL-019 and GL-020 in `docs/GO_LIVE_STATUS.md`.
