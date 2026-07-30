# Design QA — Mobile landing and focused booking

Source visual truth:

- Landing: `.context/attachments/ma1Zbk/Screenshot 2026-07-25 at 7.52.32 AM.png`
- User-reported oversized booking state: `.context/attachments/fUXqD0/Screenshot 2026-07-25 at 7.53.20 AM.png`

Implementation evidence:

- Chrome landing, 393 × 852: `.context/pass27-chrome-landing.png`
- Chrome Book Now, 393 × 852: `.context/pass27-chrome-book.png`
- Chrome Book Now, 375 × 667: `.context/pass27-chrome-book-se.png`
- Full landing comparison: `.context/pass27-chrome-landing-comparison.png`
- Focused proof/card/press comparison: `.context/pass27-chrome-card-comparison.png`

Viewport, normalization, and state:

- The source landing is 614 × 1316 physical pixels and contains iOS status glyphs plus a Safari toolbar.
- The app-owned source area was cropped at y1196 to exclude the Safari toolbar, then normalized to 393 × 766 pixels.
- The implementation was rendered in Google Chrome 150 at a 393 × 852 CSS viewport, 1× capture density, reduced motion, warm consumer theme, no authentication, and persisted essential-only cookie consent.
- The implementation comparison uses the app-owned top 393 × 777 region. Status glyphs are visible only in the source and are excluded from fidelity findings because they are device-owned.
- The focused booking regression check also used 375 × 667 to cover a short iPhone viewport.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- [P3] The first and fourth press marks differ slightly from the visual concept.
  - Location: mobile press row.
  - Evidence: the concept uses stylized “IM Magazine” and “The Woom” marks; the implementation uses Avalon’s existing real Maxim Magazine and The Loom image assets.
  - Impact: minor visual difference below the main conversion card.
  - Resolution: accepted to preserve authentic supplied brand assets rather than fabricate logos.
- [P3] Floor shadows remain slightly more visible behind the proof rail than in the concept.
  - Location: transition from hero image to proof rail.
  - Evidence: the normalized comparison shows stronger floor texture on the implementation’s right half.
  - Impact: small tonal difference; copy contrast and hierarchy are unaffected.
  - Resolution: accepted polish difference after the final gradient was tightened.

## Required fidelity surfaces

- Fonts and typography: Bebas Neue 400 matches the condensed two-line `NURSE DELIVERY` hierarchy; Inter matches the lockup, CTA, proof, route, and press copy. Heading scale, line height, tracking, and two-line wrapping align with the source.
- Spacing and layout rhythm: the logo, headline, tagline, CTA, four proof cells, card bounds, three row heights, separators, arrow controls, and press label align within approximately 0–8 normalized pixels. The card begins at 472 px in Chrome versus 474 px in the normalized source.
- Colors and visual tokens: warm oat, espresso, taupe, and stone remain consistent. The card uses a restrained warm translucent surface over the fading floor image, with no dark theme bleed.
- Image quality and asset fidelity: `avalon-nurse-delivery-hero-v4.webp` is sharp and matches the nurse, doorway, carried case, subtle backpack mark, and shadow direction. The wall seam and nurse center now align with the source.
- Copy and content: visible landing copy exactly uses `Nurse Delivery`, `Mobile IVs and more, Delivered to you.`, `Registered nurses`, `Private & secure`, `Same-day available`, `Transparent pricing`, `Ready for IV therapy?`, `We’ll help you find your therapy.`, and `Browse therapies.`
- Interaction and accessibility: all three choices are semantic links with usable tap targets. Book Now accepts name and mobile, enables only after valid input, and reaches the confirmation state. Guided and Menu routes work. There is no horizontal overflow.
- Focused booking fit: at 393 × 852 and 375 × 667, document width equals viewport width and document height equals viewport height. The focused main region’s `clientHeight` equals `scrollHeight`; no page or internal scroll is present in the normal state.

## Comparison history

- Pass 26 found the current mobile page still reflected the previous screenshot: it showed a hamburger, a three-item trust strip, a three-line tagline, and no four-column proof rail. Those elements were replaced using the 7:52 screenshot as the sole reference.
- Pass 26 found the choice card and press row were positioned for the earlier 542 × 1136 concept. The new card geometry was rebuilt from the 614 × 1316 reference: 3.75vw left inset, 4.9vw radius, and row heights of 17.75vw, 16.12vw, and 17.1vw.
- Pass 26 found the Book Now page could inherit oversized spacing and document scrolling. A focused-booking shell now owns exactly `100dvh`, uses a compact header, reduced form spacing, shorter controls, and an overflow-contained main.
- Pass 27 comparison found the hero wall seam 8 px too far right and the floor texture too strong under the card. The photo shifted left by 2vw, the fade strengthened after 47%, and the card surface opacity increased. The post-fix comparison shows the seam, nurse, card, and press anchors aligned with no remaining P0/P1/P2 issue.

## Browser verification

- Google Chrome executable: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- User agent: Chrome 150.
- Landing viewport checks: 393 × 852 and 375 × 667; no horizontal overflow.
- Book Now viewport checks: 393 × 852 and 375 × 667; no horizontal or vertical document overflow.
- Primary interactions tested:
  - Book Now → `/nurse-delivery?path=book`
  - Valid placeholder submission → `Thank you.`
  - Help Me Choose → guided question screen
  - Menu → `/protocols`
- Console and page errors: none.

Focused-region comparison was required because proof labels, card dividers, route copy, arrow sizes, and press spacing were too small to judge reliably from the full view. Both full and focused comparisons were opened and inspected.

## Pass 28 — Corner lockup, exact fold rail, and text contrast

Implementation evidence:

- 393 × 852 Chrome capture: `.context/pass28-final-393.png`
- 375 × 667 Chrome capture: `.context/pass28-final-375.png`
- Removed-color-band capture: `.context/pass28-mobile-fold-final.png`

Findings and fixes:

- The global mobile touch-target rule was forcing a 44 px brand-link box and visually pushing the Avalon mark down. The mobile lockup now explicitly uses `min-height: 0 !important` and begins at 2.93vw or the device safe-area inset, whichever is larger.
- The press rail’s earlier minimum-height calculation overshot the viewport by the card’s two border pixels. Its height is now border-accounted: the press/footer boundary is 851.95 px at 393 × 852 and 666.98 px at 375 × 667.
- The press component’s inherited warm-canvas background created a distinct rectangular color band. The press wrapper and rail are now transparent over one continuous hero canvas; the screenshot shows no separate square.
- The mobile press track uses a continuous 24-second doubled-strip animation. Computed transforms changed during both Chrome checks, confirming visible motion. Reduced-motion preference still pauses it.
- Brand, heading, tagline, and proof text compute to `rgb(9, 8, 7)`. The Book Now button text alone remains warm white at `rgb(255, 253, 248)`.
- No horizontal overflow, console errors, or page errors were found at either viewport.

## Pass 29 — Unified press and footer canvas

- User reference: `.context/attachments/QVw4gm/Screenshot 2026-07-25 at 12.58.25 PM.png`
- Chrome evidence: `.context/pass29-one-color-local.png`
- The press wrapper and its moving-logo rail previously exposed the hero’s darker oat base beside the footer’s warm bone canvas.
- Press, logo rail, footer, and document body now all compute to exactly `rgb(246, 242, 235)` (`#F6F2EB`).
- The moving press rail, exact fold position, top-left brand placement, and mobile horizontal-overflow checks remain unchanged.

## Pass 30 — Static background and centered mobile footer

- Chrome top capture: `.context/pass30-static-centered-top.png`
- Chrome footer capture: `.context/pass30-static-centered-footer.png`
- The mobile hero background layers now compute to `background-attachment: fixed`; the architectural photo stays stationary while page content scrolls.
- The press eyebrow and its accessible region label now read exactly `Trusted by`.
- Services, Company, Legal, expanded navigation links, Contact details, social controls, and legal notice are center-aligned. Disclosure chevrons remain independently right-aligned for consistent affordance.
- The expanded Services state was clicked and visually inspected. All links remain readable, centered, and usable.
- Chrome reported no console errors and no horizontal overflow at 393 × 852.

## Pass 31 — Fixed iPhone canvas, black CTAs, and left footer

- The mobile hero now uses a viewport-fixed pseudo layer instead of
  `background-attachment: fixed`, avoiding iOS Safari's unreliable handling of
  fixed CSS backgrounds.
- At 393 × 852, Chrome computed the background layer as `position: fixed` with
  zero-pixel viewport insets before and after a 360 px document scroll.
- Mobile CTA titles, subtitles, and arrow controls compute to `rgb(9, 8, 7)`.
  The primary hero Book Now button remains warm white.
- The mobile image now uses the existing near-identical unbranded v2 asset.
  Nurse placement, image crop, lighting, and architecture remain unchanged
  while the backpack no longer carries the Avalon mark.
- Services, Company, Legal, expanded links, Contact, social controls, and the
  legal notice are left-aligned. Expanded Services links share a 20 px left
  edge with the disclosure label.
- Chrome reported no console errors and no horizontal overflow at 393 × 852.
- Lint, production build, and `git diff --check` all passed.

## Pass 32 — Premium route-card elevation

- The mobile Book Now / Help Me Choose / Menu card now uses a layered warm
  shadow: a close 10% espresso contact shadow, a softer 7% ambient shadow, and
  a restrained warm-white inner highlight.
- At 393 × 852, the card keeps its 352 px width, 19.26 px radius, translucent
  warm surface, and existing fold position. The added depth does not change
  card geometry or create horizontal overflow.
- The card remains readable against both the architectural photograph and the
  warm press canvas without reading as a harsh floating app panel.
- Chrome reported no console errors or browser issues.

## Pass 33 — Proof-row contrast

- The four mobile proof labels now compute to the same `rgb(9, 8, 7)` near-black
  used by the `NURSE DELIVERY` headline.
- The override targets the visible mobile label spans, closing an older muted
  span rule that was reducing contrast despite the parent heading being black.
- At 393 × 852, all four labels remain centered within their original cells
  with unchanged wrapping, separators, height, and card position.

## Pass 34 — Natural scroll, blended handoff, and reveal motion

- The mobile nurse photograph is no longer pinned. Chrome computes all hero
  background layers with `background-attachment: scroll`, and the obsolete
  fixed page pseudo layer is absent.
- A 102 px warm-oat transition overlaps the lower hero/press boundary at
  393 × 852, removing the hard horizontal cutoff beneath the three-choice card.
- The card, press rail, footer navigation, and legal notice now reveal through
  IntersectionObserver-driven fade/rise motion as they enter the viewport.
- Brand, headline, primary Book Now button, and proof labels receive restrained
  staggered entrance motion. Reduced-motion users receive no added animation.
- The existing moving press-logo rail remains active and unchanged.

## Pass 35 — Mobile contact and social alignment

- Contact heading, email, phone, location, hours, and social row now share the
  same 20 px left edge as the footer disclosures.
- The Contact block uses one flex column instead of competing mobile grid
  overrides, eliminating the prior 8.8 px internal horizontal offset.
- All five social controls are true 44 × 44 px circles, evenly spaced on one
  row, with centered 16 px icons.
- At 393 × 852, the footer remains within the viewport width with no horizontal
  overflow.

## Pass 36 — Editorial split reference rebuild

- Visual authority:
  `.context/attachments/dpRYYs/Screenshot 2026-07-27 at 9.19.54 AM.png`.
- The desktop landing now uses the reference’s framed editorial header,
  letterspaced Avalon lockup, minimal Book/Menu/Events navigation, circular
  call/text controls, 60/40 editorial-to-photograph split, framed choice rows,
  and lower-edge press rail.
- The existing unbranded nurse-from-behind image remains unchanged on both
  breakpoints. Desktop uses the wide source and mobile uses the tall v2 source.
- At 1368 × 768, the split ends at 649.59 px and the moving Trusted by rail ends
  at 767.99 px, placing the complete press rail at the bottom of the initial
  viewport. Its marquee transform advanced during Chrome verification.
- At 393 × 852 and 375 × 667, the editorial hierarchy, all three choices, and
  opening nurse image remain readable with zero horizontal overflow.
- On mobile, the nurse image sits directly below the delivery subheadline and
  directly above the three choices; desktop keeps the image in the right-hand
  split.

## Pass 37 — Navigation and booking verification

- No Login or Plans label is present in the landing header, footer, or mobile
  member navigation.
- The moving press rail retains the exact accessible label and visible eyebrow
  `Trusted by`.
- The Book Now route was activated from the rebuilt landing and resolved to the
  focused name-and-mobile-number request form.
- The landing mount now resets preserved browser scroll to the top before the
  first frame, preventing a return navigation or refresh from clipping the
  desktop header and headline.
- Placeholder form fields now include stable `name` attributes, clearing the
  browser form-field issue.
- Chrome reported no console errors, warnings, or issues on the landing or
  booking route.

## Pass 38 — Events consumer-shell rebuild

- Source reference:
  `.context/attachments/kJJoGQ/Screenshot 2026-07-27 at 9.43.51 AM.png`.
- Replaced the inherited black/white event surface with the same warm bone,
  espresso, taupe, stone-border, Avalon-heading, and editorial spacing system
  used by the current landing.
- Reused the current consumer header on desktop and mobile. It exposes only
  Book, Menu, Events, call/text controls, and the mobile Book Now action; Login
  and Plans are absent.
- The five event variables remain interactive. Chrome verified the desktop
  detail panel, mobile accordion expansion, selected-value summary, name +
  email-or-mobile validation, and visible error announcement.
- Name, email, and mobile remain the quote fields. Planner location/date inputs
  now have stable form names and the date control uses the light color scheme.
- Upcoming and past event cards, event-detail link, consumer footer accordions,
  contact details, social controls, and wellness notice all use the new warm
  shell without dark-theme bleed.
- Chrome checks passed at 1368 × 768 and 393 × 852 with no horizontal overflow,
  console errors, warnings, or browser issues.

## Pass 39 — Corner menu, CTA arrows, and compact Events builder

- Visual references:
  `.context/attachments/Wav14g/Screenshot 2026-07-27 at 10.33.19 AM.png`,
  `.context/attachments/uj3vAr/Screenshot 2026-07-27 at 10.34.06 AM.png`,
  `.context/attachments/I8urYt/Screenshot 2026-07-27 at 10.34.52 AM.png`,
  `.context/attachments/5Y3RPo/Screenshot 2026-07-27 at 10.35.14 AM.png`,
  `.context/attachments/CEtakD/Screenshot 2026-07-27 at 10.35.31 AM.png`,
  and `.context/attachments/Q1IZ1d/Screenshot 2026-07-27 at 10.36.10 AM.png`.
- The landing and Events header now show only the existing Avalon chevron home
  link at top-left and a circular three-line control at top-right. The open
  menu contains exactly Book, Choose, Menu, and Events, and closes after route
  selection, outside press, or Escape.
- Landing action arrows now render at 33.6 px inside a 68.4 px desktop circle
  and at 24 px inside the 51.2 px mobile circle. The primary action uses warm
  espresso `#2B211B`, not the prior near-black surface.
- The Events builder no longer contains the Services tile, Services selector,
  service payload, or `Private events` kicker. Its backend now accepts the same
  required name plus email-or-mobile rule presented by the form.
- The Events title uses the self-hosted Avalon display face, Bebas Neue 400.
  The corner header contains no visible Inter wordmark.
- At 1368 × 768, the four-tile builder, all three contact fields, validation
  line, privacy line, and Get a quote control fit in the initial desktop view.
  At 393 × 852, the four accordion rows span the full card width and the full
  contact form fits without horizontal overflow.
- Chrome interaction checks covered the desktop and mobile corner menu, mobile
  Event Type accordion, empty-form validation, all route labels, and computed
  arrow dimensions. No console errors or warnings were found.

## Pass 40 — Mobile hero copy over nurse image

- Visual reference:
  `.context/attachments/cE4HrZ/Screenshot 2026-07-27 at 11.11.03 AM.png`.
- The existing mobile hero heading and subheadline now overlay the light wall
  in the nurse photograph instead of occupying a separate block above it.
- The headline resolves to the reference's two-line `Wellness / Delivered.`
  composition and the subheadline resolves to two lines beneath it without
  adding duplicate text, duplicate heading IDs, or a new image asset.
- The mobile photograph uses the existing unbranded v2 nurse asset with a
  near-square crop and a higher focal point, keeping the nurse's head, bag, and
  feet visible while preserving open wall space behind the black copy.
- At 393 × 852 and 375 × 667, the overlay remains within the image, the nurse
  remains unobstructed, the Choose one prompt follows the image, and the CTA
  stack has no horizontal overflow. The 1368 × 768 desktop split is unchanged.

## Pass 41 — Corner wordmark and compact mobile press fold

- Visual references:
  `.context/attachments/kXcQ1M/Screenshot 2026-07-27 at 11.20.38 AM.png`,
  `.context/attachments/o0YbQV/Screenshot 2026-07-27 at 11.22.42 AM.png`,
  and `.context/attachments/Kz9vuU/Screenshot 2026-07-27 at 11.23.28 AM.png`.
- `AVALON VITALITY` now sits directly to the right of the existing chevron in
  the self-hosted Avalon display face. The complete lockup remains one home
  link with the existing accessible name.
- The mobile first fold is compact enough to show the full hero photograph,
  all three choices, the `Trusted by` label, and the moving logo rail at
  393 × 852 and 375 × 667.
- The visible gap between the `Trusted by` label and logo viewport was reduced
  from approximately 48 px to 5.6 px. The rail remains a continuous 24-second
  linear marquee and its computed transform advanced during Chrome
  verification.
- Chrome measured a 375 px document width at the 375 × 667 viewport, confirming
  no horizontal overflow. The corner menu still opens to exactly Book, Choose,
  Menu, and Events.
- At 1368 × 768, the editorial split, nurse photograph, CTA stack, and moving
  press rail remain intact. Chrome reported no console errors, warnings, or
  browser issues.

## Pass 42 — Menu subheadline trim

- Visual reference:
  `.context/attachments/SLUsMC/Screenshot 2026-07-27 at 12.12.36 PM.png`.
- The View Full Menu subheadline now reads exactly `Browse therapies.` on
  desktop and mobile; the prior `and pricing` phrase has been removed.
- Chrome verified the mobile line at 393 × 852 with the existing CTA geometry,
  first-fold press rail, and zero console errors or warnings unchanged.

## Pass 43 — Choice prompt removal

- Visual reference:
  `.context/attachments/sPAGQ9/Screenshot 2026-07-27 at 12.20.10 PM.png`.
- Removed the `Choose one` label and its horizontal rule from the landing CTA
  stack instead of merely hiding it.
- The mobile Book Now card now follows the nurse image directly, closing the
  removed prompt's vertical gap. At 393 × 852, all three choices and the moving
  press rail remain visible without horizontal overflow.
- The desktop choice grid now uses three explicit rows so removing the prompt
  does not leave an empty first row. Chrome verified the complete 1368 × 768
  composition with no console errors, warnings, or browser issues.

## Pass 44 — Short landing CTA labels

- The primary CTA title now reads exactly `Book`.
- The menu CTA title now reads exactly `Therapies`, with the existing
  `Browse therapies.` subheadline retained.
- Chrome verified the shortened labels at 393 × 852 after the Choice prompt
  removal. All three choices and the moving Trusted by rail remain visible.

## Pass 45 — Registered-nurse subheadline and Book label audit

- The hero subheadline now reads exactly `IV therapies and more.` followed by
  `By registered nurses.` on its own line at desktop and mobile sizes.
- Audited `src`, `app-modules`, and `public`: no case-insensitive `Book now`
  text remains. Consumer buttons and internal nav previews now use `Book`;
  the member-credit sentence uses `Book a visit`.
- Chrome verified the new two-line subheadline and the `Book`, `Help Me Choose`,
  and `Therapies` labels at 393 × 852 and 1368 × 768. The first-fold press rail
  remains visible and no console errors or warnings were reported.

## Pass 46 — Therapies menu headline

- The `/protocols` menu headline now reads exactly
  `Physician-formulated.` followed by `Nurse-delivered.`.
- Chrome verified the heading at 393 × 852 and 1368 × 768. It remains within
  the content width, keeps the existing Avalon display face, and preserves the
  therapy list below without horizontal overflow.
- No console errors, warnings, or browser issues were reported.

## Pass 47 — Compact menu top spacing

- Reduced the consumer header's minimum height from 56 px to 32 px and aligned
  its contents to the top, placing the logo at 16 px from the mobile top/left
  edges and 27.36 px from the desktop top/left edges.
- Reduced the menu intro's top padding from the former 64–144 px range to
  24–48 px. The headline now begins at 116.32 px on 393 × 852 and 132.72 px on
  1368 × 768, while the first therapy section follows without overlap.
- Chrome verified both breakpoints with no horizontal overflow, console errors,
  warnings, or browser issues.

## Pass 48 — Quiz menu label

- Replaced the quiz's secondary `View all services` action with the shorter
  `View menu` label.
- Preserved the existing `/protocols` destination.
- Chrome verified the guided quiz at 393 × 852 with no console errors,
  warnings, or browser issues.

## Pass 49 — Mobile Text and Call actions

- Added visible `Text` and `Call` actions to the mobile header's right-side
  control group, immediately before the existing menu button.
- Both actions use Avalon’s published `(415) 980-7708` number through native
  `sms:` and `tel:` links and preserve the existing top-left brand lockup.
- Chrome verified 393 × 852 and 320 × 568. At 320 px, the brand and action
  group retain a 17.5 px gap, document width equals viewport width, and no
  overlap or horizontal overflow occurs.

## Pass 50 — Editorial Events page

- Source visual truth:
  `.context/attachments/7XkPDO/Screenshot 2026-07-27 at 12.57.30 PM.png`
  (`2438 × 1336` pixels).
- Browser-rendered implementation:
  `.context/design-qa/events-editorial-desktop.png`
  (`1366 × 750` pixels at a `1366 × 750` CSS viewport and 1× density).
- Full side-by-side comparison:
  `.context/design-qa/events-editorial-comparison.png`; the source was
  normalized to `1366 × 750` with Lanczos scaling before comparison.
- State: `/events`, warm consumer theme, initial quote step, no authentication.
- The desktop header, 50/50 editorial split, headline, subtitle, quote card,
  three event-detail controls, secondary event links, event image, and
  first-fold Trusted by rail match the source hierarchy and proportions.
- `Plans` remains intentionally omitted under the product’s standing
  no-plans direction. The authentic moving Avalon press rail is preserved in
  place of a fabricated static logo strip.
- Fonts and typography: Avalon’s existing heading and body faces preserve the
  source’s condensed display hierarchy and restrained editorial navigation.
- Spacing and layout rhythm: the first fold resolves to header `64.47px`, hero
  `621.51px`, and press rail `64.47px`; the complete rail reaches the viewport
  bottom without hiding persistent controls.
- Colors and tokens: the existing oat, espresso, warm-white, taupe, and stone
  system maps directly to the source. The quote card uses an espresso surface
  with a restrained warm shadow.
- Image quality: the supplied screenshot’s event photograph was recovered as
  a dedicated `1228 × 1108` source asset, avoiding a substitute image or
  approximate illustration.
- Copy and content: `Build your event`, the event subtitle, `Get a quote`,
  three configuration rows, transparency note, and both event links match the
  reference.
- Primary interactions tested in Chrome: location editor open/fill/Enter,
  quote CTA to contact step, native Call and Text actions, and mobile menu.
- Mobile verified at `393 × 852`: Text and Call are icon-only 44px circular
  actions, the page has no horizontal overflow, and the event image, planner,
  and type remain readable.
- Chrome reported no console errors, warnings, or browser issues.
- No actionable P0, P1, or P2 mismatch remains. The additional first press
  mark and omission of Plans are accepted product constraints rather than
  fidelity defects.

## Pass 51 — Press ticker asset recovery

- Source visual truth:
  `.context/attachments/qKsMGT/Screenshot 2026-07-28 at 9.55.00 AM.png`
  (`1316 × 452` pixels), showing the reported broken-image state.
- Browser-rendered implementation:
  `.context/design-qa/press-scroll-fixed-desktop.png`
  (`1316 × 800` pixels at a `1316 × 800` CSS viewport and 1× density).
- Combined comparison:
  `.context/design-qa/press-scroll-broken-vs-fixed.png`
  (`2632 × 800` pixels). The source crop is centered on a warm-oat
  `1316 × 800` comparison canvas without scaling or density conversion.
- State: live `https://snooches.avalonvitality.co`, warm consumer theme,
  desktop home fold and mobile `393 × 852`, no authentication.
- Earlier P0 finding: all 11 `/logos/press-dark/*.png` requests returned 404,
  replacing the press marks with broken-image glyphs.
- Fix: restored the existing press-logo directory to the deployment artifact
  and reassigned only the snooches alias to the verified preview.
- Post-fix evidence: all 11 live asset URLs return `200 image/png`; Chrome
  reports every rendered press image complete with a positive natural width.
  The desktop strip and mobile track both change transform values over an
  800ms sample, confirming continuous motion.
- Fonts and typography: unchanged; the existing Trusted by label and authentic
  logo artwork retain the intended editorial hierarchy.
- Spacing and layout rhythm: unchanged; the restored artwork stays within the
  existing rail cells on desktop and mobile with no horizontal overflow.
- Colors and visual tokens: unchanged; transparent espresso marks render on
  the warm-oat canvas without the browser's blue missing-image treatment.
- Image quality and asset fidelity: the supplied Avalon press PNGs are used
  directly; no placeholder, reconstructed, or fabricated marks remain.
- Copy and content: `Trusted by` and the existing organization names remain
  unchanged.
- Primary interaction tested: moving ticker on desktop and mobile. Chrome
  reported no console errors, warnings, browser issues, or failed images.
- No actionable P0, P1, or P2 issue remains. A focused comparison is sufficient
  because the reported regression was isolated to the press-logo asset row;
  surrounding layout and content were intentionally preserved.

final result: passed

# Snooches Desktop Homepage Design QA

## Visual truth and capture state

- Source visual truth: `.context/attachments/mQt8zA/Screenshot 2026-07-30 at 8.15.01 AM.png`
- Implementation capture: `.context/snooches-homepage-984x686-final.jpg`
- Full-view comparison: `.context/snooches-homepage-comparison-final.png`
- Focused frame comparison: `.context/snooches-homepage-frame-detail-final.png`
- Requested comparison viewport: 984 × 686 at device pixel ratio 1.
- Browser capture viewport: 999 × 696, normalized by the browser surface to an exact 984 × 686 output.
- Source metadata: 984 × 686 PNG, 144 ppi.
- Implementation metadata: 984 × 686 JPEG, 72 ppi.
- Density metadata was ignored because both comparison images have identical pixel dimensions.
- State: `/`, cookie consent resolved, menu closed, entrance motion settled.

## Final comparison

The framed first view matches the reference composition: centered black surround, cream card, 67px header, 59/41 hero split, compact editorial spacing, START slab, two helper links, image crop, and six-mark trust rail. The focused crop keeps the complete card at readable scale, so no additional detail crops were needed.

The wide-screen follow-up was checked at 2560 × 1440. The 576px first-view composition centers vertically instead of stretching with viewport height. The trust rail is part of the fixed frame row and has no initial reveal offset, so its first-paint and settled positions are identical.

## Findings and fixes

- Pass 1: the inherited page background produced a cream outer canvas, the frame height expanded on tall displays, and the default press marquee did not match the reference.
- Pass 2: added the black desktop canvas, framed header/hero/footer geometry, reference crop and typography, and the six-logo homepage compact rail.
- Pass 3: constrained and vertically centered the compact first view on tall desktops and removed the trust rail's first-load reveal shift.
- Final: no actionable P0, P1, or P2 visual differences remain. Minor P3 differences are limited to raster antialiasing and source/capture color-profile rendering.

## Responsive and interaction evidence

- 974 × 618: frame compresses without horizontal overflow or clipped controls; the trust rail remains inside the lower rounded edge.
- 1440 × 1000: frame is vertically and horizontally centered; the consumer footer remains below a black separation gap.
- 2560 × 1440: capped composition is optically centered and the trust rail stays in its final position on first paint.
- 390 × 844 and 430 × 844: original cream mobile layout and moving mobile press marquee remain active with no horizontal overflow.
- START routes to `/start`.
- Help Me Choose routes to `/nurse-delivery?path=guided`.
- Therapies routes to `/protocols`.
- Text and call controls retain `sms:+14159807708` and `tel:+14159807708`.
- Menu open, close, outside-click, and Escape behavior remain intact.
- Browser console: no errors in the verified homepage state.

## Automated checks

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:visual`: passed.
- `MOBILE_QA_ROUTES=/ MOBILE_QA_WIDTHS=390,430 npm run test:mobile`: passed 2/2.
- `npm run test:accessibility`: passed 500/500.
- `npm run assets:audit`: ran and reported the two existing oversized NAD bag images (`nad-back.png` and `nad-three-quarter.png`); this change adds no assets.
- `git diff --check`: passed.

final result: passed

---

# Snooches Full-Bleed Desktop Centering Correction

## Visual truth and capture state

- Source visual truth: `.context/attachments/RUqD5I/Screenshot 2026-07-30 at 9.14.11 AM.png`
  (`2560 × 1421`, treated as a Retina capture of approximately `1280 × 710`
  CSS pixels).
- Browser-rendered implementation:
  `.context/snooches-homepage-centered-1280x710.png`.
- Combined comparison:
  `.context/snooches-homepage-centered-comparison.png` (reference left,
  corrected implementation right).
- State: `/`, cookie consent resolved, menu closed, entrance motion settled.

## Findings and correction

- Removed the black canvas, rounded desktop frame, compact header, constrained
  image crop, and compact six-logo rail introduced by the prior pass.
- Restored the established full-bleed cream composition and the original moving
  desktop press marquee.
- Centered the complete editorial group inside the left hero column using equal
  responsive side insets and vertical grid alignment. The image, type scale,
  START slab, helper links, header, press rail, and footer retain their existing
  dimensions and behavior.
- The corrected press rail begins at the existing hero boundary and no longer
  inherits the framed layout's lowered first-paint position.
- Mobile remains outside the desktop-only rule; the `405 × 854` browser check
  showed the established mobile composition, active marquee variant, cream
  background, and no horizontal overflow.
- No actionable P0, P1, or P2 mismatch remains.

final result: passed
