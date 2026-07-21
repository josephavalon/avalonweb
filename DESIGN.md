# Design System — Avalon Events (Afterglow Clinical)

Approved 2026-07-05 via /design-consultation (3 preview iterations; research: Luma, Partiful, Airbnb, Remedy Place; outside voices: Codex + independent Claude designer).
Approved preview: `~/.gstack/projects/josephavalon-avalonweb/designs/design-system-20260705/afterglow-clinical-preview.html`

## Product Context
- **What this is:** IV-at-events platform: consumer feed/event pages/reserve/trip pages + three role-gated admin portals + on-site kiosk & queue.
- **Who it's for:** Members, guests, applicants (client); promoters, nurses, Avalon admin (portals).
- **Space:** Premium wellness events. Peers: Luma (frictionless), Airbnb (photo trust), Partiful (party energy), med-spa booking (the anti-pattern).
- **Brand thesis:** "We deliver care." We deliver (mobile — we pull up, whatever/whoever/wherever), we deliver care (medical), we care (hospitality).
- **North star:** "The easiest, smoothest wellness event booking ever."
- **Objectives:** Speed · Simplicity · Completeness — across all meanings.
- **Governing metric:** Time to Finish (TTF), booking → back on the floor. IV: back in 30. Shot: back in 5.
- **Hard invariant:** perfect HIPAA/PHI security outranks TTF; redesign for speed *within* the boundary, never around it.

## Aesthetic Direction
- **Direction:** Afterglow Clinical — nocturnal hospitality with a visible clinical spine. Extends the shipping site; never rebrands it. "Same house. New wing."
- **Decoration level:** Intentional. Photography carries all warmth and color; chrome stays flat monochrome.
- **Mood:** The last hour of a great party, engineered with an anesthesiologist's precision. Trust is the aftertaste, never the flavor.
- **References:** beta.avalonvitality.co (the source of truth), lu.ma (friction bar), airbnb.com (trust scaffolding).

## Typography — three voices, two already shipping
- **LOUD / Display:** Bebas Neue (self-hosted, shipping) — event titles, section heads, tier names at poster scale (clamp 44–160px, never below 28px).
- **CALM / Body+UI:** Inter (self-hosted, shipping, weights 400–700) — prose, buttons, labels.
- **TRUE / Clinical+Data:** IBM Plex Mono 400/500 (THE ONE NEW FONT; self-host 2 woff2, preload like Bebas) — everything medically/operationally true: protocols, credentials, license numbers, prices at rest, timestamps, queue positions, GFE states, back-on-floor times. `font-variant-numeric: tabular-nums` always. Mono never lies, never animates, never persuades.
- **Rule:** if it sells the night → LOUD; if it explains → CALM; if it is true → MONO. No fourth voice in v1.
- **Loading:** self-hosted woff2, inlined @font-face, preload above-the-fold faces (existing index.html pattern). No Google Fonts `<link>` in production.

## Color — monochrome chrome, photography carries the warmth
- **Approach:** restrained. White is the accent (the shipping `.dark` theme already declares `--accent: 0 0% 100%`).
- **Canvas:** `#000000`. **Surface:** `rgba(13,13,13,.94)` (`--glass-bg`, flat, opaque). **Warm card:** `hsl(28 12% 16%)` ≈ `#2E2822`.
- **Ink:** `#FFFFFF` primary text AND primary CTA fill; grey tiers `#CCCCCC` / `#8F8F8F` (existing AA-safe tiers).
- **Borders:** `rgba(255,255,255,.12)`, hover `.22` — borders define edges (V2 flat rule).
- **live `#C8F135` (NEW, microdosed):** CLEARED ✓, queue position, NOW DRIPPING. Text/ink only — never a button fill, never a background. ~15:1 on black.
- **Clinical stop:** existing destructive `#F04438` — clinical stops ONLY, never urgency marketing. If a guest sees red, it means medicine.
- **Event theming:** organizers pick from Avalon-authored theme rows (curated picker, blueprint amendment J) that recolor **live-state accents only**. Platform chrome, the mono voice, and the red/green clinical reservations are locked at the system level and cannot be themed over. Free-form colors/fonts/layout: never.
- **No blur, anywhere.** `--glass-blur: 0px` stands. No purple, no gradients-as-decoration, no pastel spa palette.

## Spacing & Layout
- **Base unit:** 4px. Client comfortable (16/24/32); portals compact (8/12/16).
- **Layout:** hybrid — client is creative-editorial (first viewport = poster: full-bleed photo, metadata pinned in the image plane, no card chrome); portals are grid-disciplined dense tables; kiosk is one-field-per-screen with huge targets.
- **Photography:** organizer/venue photos always render under the standard scrim (bottom gradient to black) so any upload sits in the brand automatically.
- **Radius:** cards `1.35rem` (`--glass-radius`), small elements `0.25rem` (`--radius`), buttons/chips full pill `999px`. Matches shipping components exactly.
- **Max content width:** 1100px marketing/feed; portals fluid.

## Motion — two regimes; the cut between them is the design
- **Liquid (client journey):** critically damped springs (`cubic-bezier(.22,1,.36,1)`, ~350ms), zero bounce, zero overshoot — things settle, never boing. Reserve sheet rises like Apple Pay; the chosen tier card expands in place to become the receipt (you never "go to checkout"); prices roll like a mono odometer (120ms/digit); success = one soft white glow, once, 900ms. **No confetti, ever.**
- **Still (clinical + admin):** instant state changes, full opacity. GFE, flags, credentials, consent, prices at rest, admin tables: none of it ever animates. Movement implies persuasion; medicine doesn't persuade.
- **Scar-tissue rules (from repo history, non-negotiable):** never animate blur radius; no transform/filter/will-change on `.av-page-stage` or any fixed-nav container; reveals gate pointer-events none→auto; no +90px rest offsets that overlap content before IntersectionObserver fires.

## Voice & copy
- **Brand thesis: "We deliver care."** Every headline and CTA should survive being read against this line.
- Hospitality language, never clinical-bureaucratic: "health check," never "intake"; "back on the floor," never "treatment duration."
- The mono voice states facts without adjectives. The wink (one italic concierge sentence per screen, max) is the only place personality lives: "Your nurse is Dana. She's done four hundred of these."
- Claims discipline: no treat/cure/prevent claims (FDA/FTC); the banner sells the experience, the PC delivers the medicine.

## Privacy as design (testable rules, not vibes)
- Departures board: initials only, opt-out honored. Door mode: name + clearance color, nothing else.
- The mono voice renders enums, counts, timestamps — never conditions, meds, or reasons.
- SMS is content-free ("you're up"); email links to the health check, never describes it; wallet pass carries the state enum; QR carries allergy-flag COUNT.
- Kiosk wipes between guests: no back-nav, 90s idle reset, no autofill/keyboard suggestions.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-05 | Afterglow Clinical v2 approved | /design-consultation: research + 2 outside voices + 3 preview iterations; rebuilt from shipping tokens after v1 rejected as off-brand ("must merge into beta") |
| 2026-07-05 | TTF is the governing metric | User: "time to finish is the overall goal from booking to payment to checkout to menu and actual process of administration" |
| 2026-07-05 | Curated event theming in v1, chrome locked | User: organizer image uploads + theme customization with admin audit; governed by "promoters compose, Avalon curates" |
| 2026-07-05 | "We deliver care" is the brand thesis | User-stated; triple meaning (delivery/medical/hospitality) anchors all copy |
