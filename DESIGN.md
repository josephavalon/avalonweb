# Design System — Avalon Vitality

> **North star:** the fastest, safest, scalable, mobile IV experience. **Speed kills.**
> Read this before any visual or UX decision. The Principles are hard rules, not vibes.
> The Visual System below is the shipped source of truth — use the tokens, don't reinvent.

---

## Product Context
- **What this is:** Mobile IV therapy & longevity concierge. Licensed RNs deliver IV drips, NAD+, peptides, and IM shots to your home, hotel, or office.
- **Who it's for:** Affluent high performers, execs, athletes, and biohackers in the SF Bay Area.
- **Space:** Premium wellness / concierge healthcare. Peers dress like a med-spa (teal, script, stock photos); Avalon dresses dark, precise, and clinical.
- **Project type:** Hybrid — marketing site + booking web app + member portal. **Mobile-first.**
- **Staging:** `snooches.avalonvitality.co` (deploy branch `snooches-deploy`).

---

## Design Principles (the rulebook)

Every screen is judged against these four, in order. When they conflict, **Speed wins, Safety vetoes.**

### 1. Speed kills — the booking flow IS the product
The "60 Second Checkout / No Hidden Fees" promise is a **contract**, not marketing copy. Hard targets, treated as requirements:

- **≤ 60-second checkout** from open to booked, for a returning user with a saved address.
- **≤ 3 decisions to book:** protocol → arrival window → confirm. Everything else is an optional add-on or a smart default.
- **Optimistic UI:** every tap responds in **< 100ms**. Never block the UI on a network round-trip. Reflect the choice instantly; reconcile in the background.
- **1-tap pay first:** offer Apple Pay / Google Pay before card entry. Card is the fallback, not the default.
- **Pre-fill everything knowable:** saved address (deduped — see `collapseRepeatedAddress` in `BookNow.jsx`), ASAP time, last protocol. The user confirms; they don't re-enter.
- **No dead ends, no full reloads:** steps transition in-place. Any wait > 400ms shows a skeleton that matches the real layout, never a bare spinner.
- **Subtract relentlessly:** if a field, step, or tap doesn't change what gets delivered, cut it.

### 2. Safety earns the booking
Clinical credibility is the permission to be fast. It must be visible without slowing anyone down.
- **No dark patterns.** Transparent pricing: deposit ($50) and balance shown before commit; no hidden fees; no fake scarcity.
- Honest medical framing for dose-gated/approval-gated protocols (NAD+, CBD): say "clinical review required," never hide it.
- Destructive or irreversible actions (cancel, reschedule) get a confirm or an undo window.

### 3. Scalable by tokens, not by hand
- **One source of truth:** this file + the token system in `tailwind.config.js` and `src/index.css`. Never hardcode a hex, font size, or spacing value when a token exists.
- Adding a protocol, city, or add-on is **data**, not new UI. Reuse the established patterns (menu row, glass card, foldout).
- New components must compose from existing tokens and primitives before anything new is introduced.

### 4. Mobile-first, thumb-reachable
- Design the phone first; desktop is the wide case, not the source layout.
- **44px minimum touch target**, enforced globally (`@media (hover:none)` rule in `index.css`; includes `<select>`).
- Primary action sits in thumb reach (bottom of the booking panel).
- **16px minimum** on form inputs (prevents iOS zoom-on-focus).
- **Menus are wide stacked rows, never cramped multi-column grids** (see Patterns).

---

## Visual System (shipped — formalize, don't drift)

### Theme
- **Dark is the default** (`<html class="dark">`). Light (`.daytime`) and event themes (`.warriors`, `.pride`, `.july`, `.golden-hour`) are supported via CSS-variable overrides.
- Mood: instrument-grade, premium, clinical. Quiet command, not spa softness.

### Typography
Loaded via `<link>` in `index.html` (non-blocking). Set sizes with the scale tokens, never ad-hoc.
- **Display / headings — Bebas Neue** (`--font-heading`, condensed all-caps). Scale (`tailwind.config.js`):
  - `text-display-xl` clamp(3.5rem, 9vw, 8rem) · `text-display` clamp(2.75rem, 7vw, 6rem)
  - `text-h1` clamp(2.25rem, 5vw, 4.5rem) · `text-h2` clamp(1.875rem, 4vw, 3.5rem) · `text-h3` · `text-h4`
  - **Canonical section title:** `.av-h2` (`src/index.css`) — the single class every landing section title should use.
- **Body / UI — Inter** (`--font-body`). Scale: `body-lg` 1.125rem · `body` 1rem · `body-sm` 0.875rem · `body-xs` 0.75rem (≥ 16px for reading/inputs).
- **Editorial accents:** `eyebrow` (0.625rem, 0.35em tracking, caps), `micro`, `caption`.
- _Note: Bebas + Inter are the established, self-hosted pairing. Treat as fixed unless a deliberate brand change is approved — do not introduce new families per-component._

### Color
HSL CSS variables, theme-scoped. Dark theme is canonical:
- **Ground** `--background` `0 0% 4%` (#0A0A0A) · **Surface/card** `0 0% 7%` · **Border** `0 0% 14%`
- **Text hierarchy (dark)** — the override in `index.css` flattens opacity utilities to white, so hierarchy is restored by an AA-safe grey ramp:
  - **Primary** `#FFFFFF` (headings, key labels)
  - **Secondary** `rgba(255,255,255,0.72)` (~8.7:1) — nav, sub-labels, `text-foreground/56–74`
  - **Tertiary** `rgba(255,255,255,0.56)` (~6.0:1) — microcopy, `text-foreground/<56`
- **Accent:** none in dark — white *is* the accent. Color is reserved for event themes and semantic states only.
- **Semantic:** destructive `0 84.2% 60.2%`. Keep success/warning muted to fit the dark, accent-less palette.
- **Glass material:** `--glass-bg rgba(7,7,7,0.72)`, `--glass-blur 18px`, `--glass-border rgba(255,255,255,0.13)`, `--glass-radius 1.35rem`. All smoked-glass surfaces inherit these.

### Spacing & Radius
- **8px baseline rhythm.** Use tokens: `rhythm`(8) `rhythm-2`(16) `rhythm-3`(24) `rhythm-4`(32) `rhythm-6`(48) `rhythm-8`(64); `gutter`(16) `gutter-lg`(32); `section-sm`(48) `section`(80) `section-lg`(120). Avoid off-grid half-steps.
- **Radius:** base `--radius` 0.25rem (4px); scale `sm/md/lg/xl/2xl/3xl` derive from it. Glass surfaces use `--glass-radius` 1.35rem.
- **Widths:** `measure` 38rem (~65ch reading), `content` 72rem (section container).

### Layout & Patterns
- **Menus = wide stacked rows.** Product / treatment / dose / add-on lists render as **single-column, full-width rows** (`grid grid-cols-1`), each row: icon · label · meta · price/action. Never a 2-column grid that crams long labels (e.g. "VITAMIN C IV PUSH - 15G"). Applies to `/book` therapy + add-ons, `/protocols`, dose pickers. Consistent on mobile and desktop.
- **Cards earn their place:** glass card only when the card *is* the interaction. No decorative card grids.
- **Hybrid layout:** editorial composition for marketing (full-bleed hero, one job per section), calm utility surfaces for the booking app.

### Motion
- Editorial easing (`ease-editorial`), Framer Motion `whileInView` reveals (`once: true`).
- Durations: micro 50–100ms, short 150–250ms, medium 250–400ms. Animate `transform`/`opacity` only.
- Respect `prefers-reduced-motion`. Motion serves hierarchy and speed feedback — never decoration that delays a tap.

### Accessibility (non-negotiable)
- 44px touch targets (global rule covers button/a/[role=button]/select).
- WCAG AA contrast — the grey text ramp above stays ≥ 4.5:1 on the dark ground.
- `focus-visible` rings on all interactives; never `outline:none` without a replacement.
- Body/input text ≥ 16px.

---

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-09 | DESIGN.md created (principles-first, hard speed targets) | Formalize the shipped dark/Bebas system + encode "speed kills / fastest-safest-scalable-mobile" as enforceable rules |
| 2026-06-09 | Text hierarchy: AA-safe grey ramp (primary/secondary 72%/tertiary 56%) | F-002 — the night-theme override flattened all text to white; restored hierarchy |
| 2026-06-09 | Menus standardized to wide stacked rows | F-004 — dose/add-on/treatment cards were cramped 2-up; full-width rows fit long labels and read consistently |
| 2026-06-09 | `<select>` joins the 44px touch-target rule | F-001 — booking date/time pickers were sub-44px on mobile |
