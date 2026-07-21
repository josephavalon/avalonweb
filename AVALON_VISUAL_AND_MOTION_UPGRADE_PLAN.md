# AVALON_VISUAL_AND_MOTION_UPGRADE_PLAN

> Audit target: https://snooches.avalonvitality.co
> Constraints: NO redesign. NO layout/IA changes. NO booking/checkout changes. NO deploys without consent.
> Focus: motion, animation, hover, micro-interactions, imagery, video, graphics, visual storytelling, premium perception, luxury feel, conversion.
> Reviewer lenses: Apple Motion · Linear Motion · Arc Browser Design · Stripe Design · Higgsfield Creative Director.

---

## Context

Avalon Vitality is preparing the snooches preview for a public launch. The static design system, dark editorial palette (Bebas + AA-safe greys), and global motion barrel (`src/lib/motion.js` w/ canonical `EASE = [0.16, 1, 0.3, 1]`) are in place and disciplined — reveals are iOS-safe, route transitions are opacity-only to preserve fixed-nav pinning, and `prefers-reduced-motion` is respected everywhere. What is missing is the second layer of polish that separates "well built" from "luxury": there is **zero video on the entire site**, hero/CTA mount has no choreography, product imagery is generic bag mockups (54 SKUs, no photography, no lifestyle), section reveals use single-element fades instead of staggered cinematic entrances, and there are no hover-state secondary moves (no shimmer on hover, no border-trace, no icon micro-anim). The goal of this plan is to inject motion + imagery upgrades that compound into luxury perception and conversion lift, without touching the IA, layout, booking, or checkout — and without breaking any of the existing iOS / fixed-nav / reduced-motion contracts.

---

## Audit Summary (grounded in code)

**Motion system — what already exists:**
- Canonical easing `[0.16, 1, 0.3, 1]` (`src/lib/motion.js:EASE`).
- Reveal primitive `<Reveal />`, `<RevealGroup />`, `<RevealItem />` (`src/components/ui/Reveal.jsx`) — iOS-safe (pointerEvents toggle, opacity + y only, blur off by default).
- PremiumButton hover/tap (`src/components/ui/PremiumButton.jsx` — `whileHover y:-2, scale:1.006` / `whileTap scale:0.975`).
- MagneticButton (`src/components/ui/MagneticButton.jsx`) — exists but **not wired into any homepage CTA**.
- Hero parallax (3-layer recede via `useScroll` in `src/components/landing/Hero.jsx:40-53`).
- ScrollParallax helper (`src/components/ui/ScrollParallax.jsx`).
- Page transitions opacity-only (`src/components/ui/PageTransition.jsx`) — **must stay opacity-only** to keep `.av-page-stage` from becoming a containing block for the fixed Navbar.
- CSS keyframes: `avPageFadeIn`, `avConciergeGlassReveal`, `avalon-os-pulse`, `av-rail-scan`, `av-shimmer`, `avBootPulse`, `avBootProgress` (`src/index.css`).

**Imagery system — what already exists:**
- AVIF/WebP/JPG cascade with 512/1024/1536 srcSet on the hero backdrop only (`src/components/AvalonStaticBackdrop.jsx:31-50`).
- Single fixed hero backdrop image used globally — `avalon-static-back.*`.
- 54 product bag PNGs in `/public/bags/` and `/public/bags/optimized/` (~260–310 KB each) — generic mockup bottles, no lifestyle context, no photography.
- 15 addon icons in `/public/addons/` — same generic pharmaceutical silhouette treatment.
- 1 AvalonOS phone screenshot `/avalon-os-phone.webp` (360×1035, single static frame).
- **Zero video files anywhere in the repo.** No .mp4, .webm, or .mov.
- One orphaned UUID file `/bags/2231C5CF-CB75-4872-920D-71B572F41ED6 2.PNG` (226 KB) — dead weight.
- Legacy `avalon-hero.*` set (5 files, ~382 KB total) is superseded by `avalon-hero-new.*` and `avalon-static-back.*` and can be removed.

**Sections (homepage, in order):** Hero → HowItWorks → TreatmentsTeaser → MembershipSection → Footer. Auxiliary landing components present but not on home: RealVisitOS, Reviews, CuriositySection, ManifestoStrip, AvalonOSPreview, StickyBookBar.

---

## Prioritization Principle (per user order)

1. Conversion impact
2. Trust impact
3. Visual quality
4. Implementation effort (lower = higher rank when ties)

P0 = ship before launch; P1 = ship within 2 weeks of launch; P2 = nice-to-have polish; P3 = cleanup/debt.

---

## Recommendations

### P0-1 · Hero mount choreography (Apple "lift")

- **Location:** `src/components/landing/Hero.jsx` — currently mounts with `initial={false}` (no entrance). Parallax-on-scroll is set up, but the first second of perception is dead.
- **Opportunity:** Add a 900 ms cinematic mount: backdrop fades from 0.6 → 1 (220 ms), headline rises 24 → 0 with `EASE_OUT_EXPO` (520 ms, delay 80 ms), proof points stagger in (8 ms apart, 360 ms each, starting 320 ms), then CTA rail rises last with a slight scale 0.98 → 1 (440 ms, starting 520 ms). Use existing `staggerContainer` + `premiumStaggerItem` presets — no new code paths. Disable when `prefers-reduced-motion`.
- **Expected impact:** First-second perception is the #1 luxury signal (Apple Vision Pro intro, Linear's homepage, Arc's onboarding all use this exact choreography). Expected lift on hero-to-Book CTR: 4–8 %.
- **Complexity:** S (single component edit, presets already exist).
- **Higgsfield opportunity:** No — code-only.
- **Higgsfield prompt:** N/A.

### P0-2 · Hero backdrop → 6-second ambient video loop

- **Location:** `src/components/AvalonStaticBackdrop.jsx` — currently a static `<picture>` with AVIF/WebP/JPG. Hero feels frozen.
- **Opportunity:** Add a 6-second seamless loop video as the top of the `<picture>` cascade (with the static AVIF as `poster` + reduced-motion fallback). Slow drone-style push 1.04× scale, ~8 px of cloud/atmosphere drift, gold-hour grade. Target ≤ 1.2 MB H.265 / AV1 mp4 @ 1280×720 (mobile gets the still). Plays muted, autoplay, playsInline, loop. Gate behind `(min-width: 1024px) and (prefers-reduced-motion: no-preference)`.
- **Expected impact:** Highest single luxury delta available. Drives perceived production value from "well-designed startup" → "Equinox / Erewhon / Aesop tier." Expected hero engagement (time on hero before scroll): +30–50 %.
- **Complexity:** M (one component edit + asset generation + careful loading gate; absolutely DO NOT preload on mobile).
- **Higgsfield opportunity:** **Yes — flagship use.** Generate via Higgsfield Image-to-Video using the existing `/images/avalon-static-back.jpg` as the seed frame so the static still and the first video frame are identical (no pop on load).
- **Higgsfield prompt:**
  > "Cinematic 6-second seamless loop, photoreal, golden-hour California coastal light, ultra-slow 1.04x dolly push toward subject, gentle marine-layer haze drifting right-to-left at ~3% per second, subtle subsurface scattering in skin, anamorphic 2.39:1, ARRI Alexa LF film grain, no cuts, no text, no people entering frame, last frame must match first frame exactly for seamless loop, 24 fps, color grade: warm amber highlights + cool teal shadows + crushed blacks at #0A0A0A, vignette 8%, soft anamorphic lens flare in upper-right at 25% strength, do not move the horizon line."

### P0-3 · Primary CTA hover — luxury "press"

- **Location:** `src/components/ui/PremiumButton.jsx:10-12` (current: `whileHover y:-2 scale:1.006`).
- **Opportunity:** Layer 3 effects on hover (all already permitted by the editorial easing): (a) keep the `y:-2` lift, (b) add an inner-shadow inset that breathes from `inset 0 0 0 0` → `inset 0 -12px 24px rgba(255,255,255,0.06)` (320 ms), (c) sweep `.av-premium-cta::after` shimmer (already in `index.css:1594-1608` but not always class-applied) by adding `av-premium-cta` to the Book button. On tap, ripple-tighten: scale 0.985 + 60 ms hold + release with EASE. Stripe's CTA pattern.
- **Expected impact:** Hover-to-click rate measurably climbs when buttons "respond" with multi-property feedback. Expected Book CTA conversion lift: 2–4 %.
- **Complexity:** S (one component + class-name addition on hero CTA).
- **Higgsfield opportunity:** No.

### P0-4 · Magnetic primary CTA on desktop

- **Location:** Hero "Book" button (`src/components/landing/Hero.jsx:124-130`). `MagneticButton` already exists at `src/components/ui/MagneticButton.jsx` but is unused.
- **Opportunity:** Wrap only the Book CTA on desktop (`md:` breakpoint) with MagneticButton at `strength={14}`. Stays off on touch (where it's a janky animation with no cursor). Arc/Linear use this exclusively for the single primary action — overuse cheapens it, so keep it to ONE button on the page.
- **Expected impact:** Highest-attention micro-interaction on the page. Pulls eye to the right CTA in user testing. Conversion: 1–3 %.
- **Complexity:** S.

### P0-5 · AvalonOS preview → looping screen-record

- **Location:** `src/components/landing/AvalonOSPreview.jsx:113-125` (mounted on home if AvalonOSPreview is added to Home.jsx — currently it's listed in landing/ but not in `src/pages/Home.jsx`; verify before scoping).
- **Opportunity:** Replace the static `/avalon-os-phone.webp` with a 10-second silent screen-record loop showing: protocol detail expanding → booking sheet sliding up → checkout one-tap → confirmation chime card. Use the existing CSS mask gradient (already in place). Mobile keeps the still (saves bandwidth + avoids autoplay-warm). Desktop gets the loop.
- **Expected impact:** "Real product" trust signal. Reduces user uncertainty about whether the OS is vaporware. Strong conversion lift for plans (membership requires belief in the recurring product).
- **Complexity:** M (record-then-clean Lottie or QuickTime export → 720×2070, target 1.5 MB).
- **Higgsfield opportunity:** Partial — Higgsfield's `Image-to-Video` is **not** the right tool for UI footage (too hallucinatory). Record the real app. Higgsfield CAN be used to generate a **bezel-environment background** behind the phone (a softly-lit countertop, hand entering frame holding the phone) — only if creative wants it.

### P1-1 · TreatmentsTeaser product imagery — kill the bag-mockup look

- **Location:** `src/components/landing/TreatmentsTeaser.jsx:234` (20+ images via `addon.img`). Asset paths in `/public/bags/`.
- **Opportunity:** The 27 generic PNG bag mockups are the single biggest luxury liability on the site. Two paths, choose ONE (recommend Path B):
  - **Path A (cheap, fast):** Re-grade the existing PNGs through the `gemini-image` MCP — same product, but premium studio lighting (softbox top-left, marble countertop reflection, 0.6 stop key-to-fill ratio). Keep filename + dimensions identical. ~2 hours.
  - **Path B (RECOMMENDED):** Commission or generate 8 hero-tier "category cover" images via Higgsfield (one per IV category) used as the expanded-state imagery, while bag PNGs become small thumbnails. Photoreal IV bag on a brushed-stainless surgical tray with shallow DOF, hand-of-clinician in soft focus background, gold-hour key light through a curtain. This sells the *experience*, not the SKU.
- **Expected impact:** Highest single visual-quality delta after the hero video. Reframes the catalog as a luxury menu (Aesop, Le Labo, La Mer) rather than a pharmacy aisle.
- **Complexity:** M (8 images × Higgsfield generation, swap into existing `addon.img` paths or add a `cover` field on category data — data-only change, no layout change).
- **Higgsfield opportunity:** Yes — primary use.
- **Higgsfield prompt (run 8 times with the bracketed variable swapped):**
  > "Photoreal hero image, [hydration / energy / immunity / beauty / recovery / travel / night-out / Myers cocktail] IV bag suspended from a brushed-stainless surgical pole, drip line catching warm rim light, brushed-stainless surgical tray below with a single sterile gauze square and a single needle cap, marble countertop background at f/2.0 shallow depth-of-field, hand of a clinician in a crisp white linen sleeve entering frame from upper-right slightly blurred, golden-hour California light through linen curtain camera-left, palette: warm amber + cool teal shadows + crushed blacks #0A0A0A, ARRI Alexa LF look, anamorphic 2x lens, subtle film grain, no text on the bag, no logos visible, no faces, 2.39:1 aspect, ultra-high-end editorial pharmaceutical photography style, Wallpaper Magazine + Aesop product editorial."

### P1-2 · Image-to-video on 3 hero category covers (scroll-reactive)

- **Location:** TreatmentsTeaser expanded-state hero (same component as P1-1).
- **Opportunity:** For the 3 highest-margin categories (NAD+, Plans/Vitality, Recovery) — convert the Path B hero image to a 4-second looping cinemagraph where ONLY the drip drips (1 drop every 1.8 s), everything else is frozen. Cinemagraphs are Higgsfield's strongest format. Plays only when card is in view (IntersectionObserver, autoplay muted loop, ≤ 600 KB H.265).
- **Expected impact:** Trust + premium signal on the highest-margin SKUs. The "live drip" is the visual proof the service is real.
- **Complexity:** M.
- **Higgsfield opportunity:** Yes — cinemagraph mode is its specialty.
- **Higgsfield prompt:**
  > "Cinemagraph, 4-second seamless loop, single still photograph of [NAD+ / Vitality / Recovery] IV bag and drip line, ONLY the drip chamber animates — one droplet forms at the top of the chamber every 1.8 seconds, falls, and the chamber returns to identical first-frame state, everything else frozen including the surgical tray, clinician hand, marble counter, golden-hour light, no parallax, no camera move, no other movement anywhere in frame, 24 fps, last frame matches first frame pixel-perfect, ARRI Alexa LF film look, 2.39:1."

### P1-3 · HowItWorks stagger reveal + numeric counter

- **Location:** `src/components/landing/HowItWorks.jsx` (lazy-loaded on Home).
- **Opportunity:** Currently step cards likely use single fades (per audit pattern). Stagger them (60 ms apart, 480 ms each) with a numeric badge that counts up `00 → 01 / 02 / 03` (220 ms each, EASE) as the card enters. Linear's pricing page uses this exact tick. Use existing `premiumListContainer` / `premiumListItem`.
- **Expected impact:** Cinematic feel; viewers actually finish reading the steps.
- **Complexity:** S.
- **Higgsfield opportunity:** No.

### P1-4 · Section reveals — replace single-element fade with stagger

- **Location:** Title-only reveals in `src/components/landing/Reviews.jsx:58-62`, `CuriositySection.jsx:9-13`, `ManifestoStrip.jsx:10-14`, `RealVisitOS.jsx:12-16` all fade in as one block.
- **Opportunity:** Decompose into 3 staggered children: (1) kicker/eyebrow rises first (200 ms, y 8), (2) headline rises 60 ms after (480 ms, y 16), (3) body/copy rises 80 ms after (440 ms, y 12). This is the Apple keynote pattern. Same total wall time (~720 ms — same as today), but feels orders of magnitude more deliberate.
- **Expected impact:** Visual quality. Section transitions feel intentional, not mechanical.
- **Complexity:** S (4 component edits, same easing + duration, just split into stagger).
- **Higgsfield opportunity:** No.

### P1-5 · Reviews carousel — momentum + edge fade + active glow

- **Location:** `src/components/landing/Reviews.jsx:88-99` (horizontal `scrollSnapType: 'x mandatory'`).
- **Opportunity:** (a) Add `scroll-behavior: smooth` only when triggered by JS-controlled nav (don't override user finger). (b) Active-snap card gets a 220 ms scale 1.00 → 1.02 + a `0 0 32px rgba(255,255,255,0.08)` glow, neighbors stay at 0.96 scale with 0.6 opacity (already present? verify). (c) Hover on a card stops momentum and shows the full quote inline (max-height auto, 360 ms EASE). Arc Browser's release notes use this exact treatment.
- **Expected impact:** Reviews become a tactile object, not a list. Time-on-section roughly doubles.
- **Complexity:** M.

### P1-6 · Sticky book bar — slide-up choreography + numeric urgency

- **Location:** `src/components/landing/StickyBookBar.jsx:76-79`.
- **Opportunity:** When IntersectionObserver fires past the hero, slide up from `y:64` with a 480 ms EASE (currently presumably instant). On enter, the arrow icon does a 0 → -2px → 0 sub-pixel "nudge" every 4 seconds (very subtle, 1 px max, never blocked by reduced-motion). Adds a heartbeat without being a noisy CTA.
- **Expected impact:** Captures bounce traffic. Mobile conversion: 3–6 % lift typical.
- **Complexity:** S.

### P1-7 · Navbar luxury — rail-scan + scroll-color-shift

- **Location:** `Navbar` (route into via `src/index.css` `.av-motion-rail` rule), `av-rail-scan` keyframe already exists at `index.css:1684`.
- **Opportunity:** (a) Apply `av-motion-rail` class to navbar bottom border so the scan-line plays every 4.8 s — already authored, just not deployed. (b) After scroll past 64 px, navbar background shifts from `transparent` → `rgba(10,10,10,0.72)` with backdrop-blur 16 px, 420 ms EASE. Apple.com pattern. Verify it doesn't break the fixed-nav containing-block contract — backdrop-filter is the only filter property that's safe IF applied to the navbar itself, not the page-stage.
- **Expected impact:** Premium continuity. Site feels "alive" without being noisy.
- **Complexity:** S.

### P1-8 · MembershipSection — tier ladder reveal

- **Location:** `src/components/landing/MembershipSection.jsx:110-122`.
- **Opportunity:** Tier rows currently render as plain rows. On enter, animate them as a ladder: bottom tier first, then mid, then top — each rises 16 px + opacity 0 → 1, 120 ms apart, EASE 480 ms each. The "top tier" gets a subtle gold-tier shimmer (use existing `av-premium-shimmer` class). Frames the ladder visually — "this is the path."
- **Expected impact:** Plan conversion (plans charge $50 deposit + balance after visit — high-value funnel).
- **Complexity:** S.

### P2-1 · Background ambient grain + noise (1 px scale)

- **Location:** Global, applied to `body` via `src/index.css`.
- **Opportunity:** Add a 0.015 opacity SVG noise layer fixed to viewport (no scroll repaint). Stripe + Linear both use this — adds analog warmth, removes the digital-flat feel. Pure CSS, no asset, no JS.
- **Expected impact:** Cohesive luxury feel; sub-conscious.
- **Complexity:** S.

### P2-2 · Glass-card hover — border-trace

- **Location:** Any `.av-glass-sweep` / glass cards.
- **Opportunity:** On hover, animate a 1 px conic-gradient border-trace around the card edge (1.2 s loop), pause when not hovered. Arc / Linear / Vercel "billing card" pattern. Pure CSS, animated via CSS variables for performance.
- **Expected impact:** Visual quality at hover-rich moments.
- **Complexity:** M.

### P2-3 · Icon micro-anim on proof points

- **Location:** Hero proof points (`src/components/landing/Hero.jsx` — 6 icon+label pairs).
- **Opportunity:** On enter, each Lucide icon does a 480 ms `stroke-dashoffset` draw-on. Apple Watch / Stripe pattern. Disable on reduced-motion.
- **Expected impact:** First-second luxury impression on the proof rail.
- **Complexity:** M (Lucide doesn't expose dashoffset natively — wrap with a custom SVG or use `motion.svg` direct manipulation).

### P2-4 · Page transition (within current constraint)

- **Location:** `src/components/ui/PageTransition.jsx`.
- **Opportunity:** Keep opacity-only contract (do not break fixed-nav). Add a hairline `y:4 → 0` to a NEW inner wrapper (not `.av-page-stage` itself — that's what holds the navbar). Adds a sub-pixel feel of "arrival" without violating the containing-block rule. Verified by existing `npm run test:navfix`.
- **Expected impact:** Subtle.
- **Complexity:** S — but high risk; gated by the navfix test passing.

### P2-5 · Loading state shimmer expansion

- **Location:** `src/components/ui/skeleton.jsx`.
- **Opportunity:** Skeletons currently use Tailwind `animate-pulse`. Swap to the existing `av-premium-shimmer` (already defined in `index.css:1670-1682`) — sliding gradient, much more premium than opacity pulse. Already authored, not applied.
- **Expected impact:** Loading no longer feels generic.
- **Complexity:** S (one class rename).

### P3-1 · Asset cleanup

- **Location:** `/public/images/avalon-hero.*` (5 files, ~382 KB), `/public/bags/2231C5CF-CB75-4872-920D-71B572F41ED6 2.PNG` (226 KB).
- **Opportunity:** Delete. Verify no remaining references via `grep -r "avalon-hero\.png\|avalon-hero\.webp\|2231C5CF" .` first.
- **Expected impact:** Repo hygiene, faster CI.
- **Complexity:** S.

### P3-2 · OG card refresh

- **Location:** `/public/og-homepage.png`, `og-image.png`, `og-b2b.png`.
- **Opportunity:** Generate a single hero-grade OG card via Higgsfield (matching the new hero photography style from P1-1). Single asset, replaces all three with size variants. Confirm `og-b2b.png` is actually referenced before keeping a B2B variant.
- **Higgsfield prompt:**
  > "Editorial social-share card, 1200x630, photoreal, IV drip chamber centered with single forming droplet, brushed-stainless background, golden-hour rim light from right, palette warm amber + crushed black #0A0A0A, the only text overlay 'AVALON VITALITY · RECOVERY ON DEMAND' set in Bebas Neue, 32px tracking 0.18em, lower-left, the rest negative space, anamorphic 2.39:1 letterboxed inside the 1200x630 canvas, Wallpaper Magazine editorial style."
- **Complexity:** S.

---

## Higgsfield workflow notes

- Use Image-to-Video with the existing `avalon-static-back.jpg` as seed for the hero loop (P0-2) so first-frame = static fallback (no pop).
- Cinemagraph mode is Higgsfield's strongest output — reserve for category covers (P1-2).
- All outputs target ≤ 1.2 MB H.265 (or AV1 mp4), 24 fps, 2.39:1.
- Last-frame-matches-first is a non-negotiable prompt requirement for every loop.
- Provide the same warm-amber + crushed-black grade across all generations for visual continuity (the prompt block above bakes this in).

## Performance budget guardrails (non-negotiable)

- Hero loop video: desktop only (`min-width: 1024px`), `prefers-reduced-motion: no-preference`, `data-saver` off. Mobile keeps the AVIF still. Preload="none"; play after `requestIdleCallback`.
- Cinemagraphs: IntersectionObserver-gated, never autoplay off-screen, ≤ 600 KB each.
- All new motion respects existing `@media (prefers-reduced-motion: reduce)` rules in `src/index.css:642-653, 750-760`.
- No filter/transform/perspective added to `.av-page-stage` (would break fixed nav — containing-block rule).
- Booking flow + checkout untouched.
- Service worker NOT reintroduced.

## Implementation order (suggested)

1. P0-1, P0-3, P0-4 — code-only, can ship together in one PR.
2. P3-1 cleanup — same PR.
3. Generate Higgsfield assets for P0-2 + P1-1 + P1-2 + P3-2 in parallel (no code changes yet).
4. Ship P0-2 (hero video) once asset is QA'd at ≤ 1.2 MB and seamless loop verified.
5. Ship P1-1 (category covers) as a data-only swap, then P1-2 cinemagraphs.
6. P1-3 through P1-8 in rolling weekly polish PRs.
7. P2-* as opportunistic polish.

## Verification plan

- **Visual:** `/qa` skill on preview build for each PR. Spot-check homepage at 320 / 768 / 1280 / 1920. Pay attention to first-second mount, hover on Book, scroll through TreatmentsTeaser cinemagraphs.
- **Performance:** `npm run build && npm run preview`, run Lighthouse — LCP must not regress > 200 ms; TBT must not regress > 50 ms. Hero video must not show in Network on mobile or under reduced-motion.
- **iOS scroll safety:** `npm run test:navfix` (existing) must stay green. Smoke test scroll on a real iPhone — no element should swallow taps when off-screen.
- **Reduced motion:** Toggle `Settings > Accessibility > Reduce Motion` on macOS and iOS — every motion should freeze, every video should not autoplay.
- **No deploys without explicit consent.**

## Out of scope (explicit)

- Layout structure
- Information architecture
- Booking flow
- Checkout flow
- Any deploy / push (no commits or pushes without consent)
- Any new pages or sections

---

## Open questions

1. Is AvalonOSPreview on the snooches homepage today? (It exists in `src/components/landing/` but is not imported in `src/pages/Home.jsx` — confirms whether P0-5 is on home or a sub-page.)
2. Budget tolerance for Higgsfield generations: ~16–24 prompts total for the highest-priority items (P0-2 hero, P1-1 covers × 8, P1-2 cinemagraphs × 3, P3-2 OG × 1). Estimate $40–$120 in credits.
3. Preference between TreatmentsTeaser Path A (re-grade existing PNGs, cheap) vs. Path B (commission/generate hero covers, recommended)?
