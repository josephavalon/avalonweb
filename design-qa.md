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

---

# Start Mobile Balance and Atomic Form Reveal

## Visual truth and capture state

- Production baseline: `.context/qa/start-mobile-production-before-390x844.png`
  (Chrome CSS viewport `390 × 844`).
- Browser-rendered implementation:
  `.context/qa/start-mobile-balanced-390x844.png` (Chrome CSS viewport
  `390 × 844`).
- Full-view comparison:
  `.context/qa/start-mobile-before-after-390x844.png` (production baseline
  left, corrected implementation right).
- Loading-state comparison:
  `.context/qa/start-mobile-loading-final-390x844.png` (complete static
  loading preview left, final Cognito form right).
- State: `/start`, cream theme, current appointment defaults visible, cookie
  banner dismissed, no patient information entered, no form submitted.

## Findings, correction, and post-fix evidence

- [P1 resolved] At `390 × 844`, the previous short-phone compression was
  applied to every mobile height. The form ended near `642px`, leaving roughly
  `202px` of dead canvas below it. The standard-phone contract now expands the
  section from `101.59px` to `799.06px`, leaving a balanced bottom inset while
  retaining a true `844px / 844px` no-scroll document.
- [P1 resolved] Cognito previously revealed its form as soon as the empty form
  shell appeared, then streamed date, time, consent, and button controls in on
  later frames. The CSS readiness gate now keeps the native form hidden until
  all final controls exist. A `25ms` browser sample found only two visible
  states: complete static form preview, then complete native form. No partial
  native field state was visible.
- [P1 resolved] Native date and time controls were optically left-aligned by
  asymmetric padding. Both now compute to `text-align: center` with `48px`
  left and right padding, and retain visible defaults `2026-08-20` and
  `08:00` after focus.
- All five native fields and the primary button are `52px` high at
  `390 × 844`; text fields remain start-aligned while only date/time values are
  centered.
- `375 × 667` and `320 × 568` retain `44px` controls, no horizontal overflow,
  and `scrollHeight === clientHeight`; the smallest view preserves the full
  intake, consent, and START action while hiding only repeated supporting
  notes.
- Desktop `1280 × 900` retains the established layout, visible appointment
  defaults, centered date/time values, and no horizontal overflow.
- Primary interaction check: date and time were focused in Chrome; their
  values remained present, `aria-invalid` stayed unset, and no visible
  validation error appeared. No form was submitted.
- Vital Ice regression check used the production Cognito form number. Its
  treatment dropdown, date, time, and START button all loaded; the atomic gate
  released the complete form and introduced no horizontal overflow.
- The local Vite/React development runtime continues to expose Cognito's
  pre-existing third-party `seamless.js` null `insertBefore` exception during
  StrictMode remounting. The form recovers and loads; this was not introduced
  by the layout or readiness changes and will be rechecked on the deployed
  production build.
- No actionable P0, P1, or P2 visual mismatch remains.

## Comparison history

- Pass 1 confirmed the production form was complete but vertically compacted,
  with date/time text offset left and approximately `202px` of unused canvas.
- Pass 2 expanded standard-phone rhythm while preserving the short-phone
  no-scroll contract; visual comparison confirmed balanced top and bottom
  spacing.
- Pass 3 replaced the partial native reveal with a geometry-matched complete
  loading preview and confirmed a single atomic swap to the final form.

## Automated checks

- `git diff --check`: passed.
- `npm run lint`: passed (217 source files).
- `npm run build`: passed.
- `npm run test:front-door`: passed.
- `npm run test:privacy`: passed.
- `npm audit --omit=dev --audit-level=high`: passed; two existing moderate
  React Router advisories remain below the requested severity threshold and
  require a separate breaking major-version migration.

final result: passed

---

# Start Appointment Visibility and Mobile Fit

## Visual truth and capture state

- Source visual truth:
  `.context/attachments/ZHooXn/Screenshot 2026-08-20 at 3.43.07 AM.png`
  (`482 × 1022` physical pixels, including iOS status and Safari toolbar chrome).
- Browser-rendered implementation:
  `.context/qa/start-mobile-after.png` (Chrome CSS viewport `390 × 844`).
- Combined comparison:
  `.context/qa/start-mobile-source-vs-after.png` (reported source left,
  corrected implementation right).
- The source's app-owned region was cropped from `y=80` through `y=924`, then
  normalized to `390 × 844` before comparison.
- State: `/start`, form loaded, cookie choice resolved, no fields edited, and
  no form submitted.

## Findings, correction, and post-fix evidence

- [P1 resolved] Cognito previously initialized Appointment Time from the
  device's current time (`3:42 AM` in the source), immediately placing the
  untouched form in an invalid state. The saved form now initializes to the
  valid opening value `8:00 AM`; Appointment Date initializes to today.
- [P1 resolved] The source clipped the `START` heading beneath the consumer
  header and required vertical scrolling to reach supporting copy. The mobile
  intake now clears the complete utility/navigation stack and locks to one
  dynamic viewport with no document or internal form scroll.
- [P2 resolved] A later global `61px` input rule overrode the focused form's
  compact treatment. All five mobile controls now share the same `44px` height,
  `16px` text, cream fill, border, radius, and visible foreground value.
- At `390 × 844`, the document and focused main both report
  `scrollHeight === clientHeight === 844`; the complete heading, fields,
  consent, START button, deposit note, and service-SMS note are visible.
- At `360 × 640`, document and focused-main height both equal `640`, with no
  horizontal overflow and all core content visible.
- At `320 × 568`, document and focused-main height both equal `568`. The core
  intake, required consent, and START action remain visible at 44px touch
  height; only repeated coverage/deposit/SMS reminders collapse at this
  constrained height.
- Appointment Date renders `08/20/2026`; Appointment Time renders `08:00 AM`.
  Both controls accept focus, retain their values, and report no invalid state
  or validation error. The date bounds are `2026-08-20` through `2026-10-19`,
  preserving the requested 60-day booking window.
- The combined comparison shows the original clipped heading and red invalid
  time treatment removed, while the existing Avalon type, color, form order,
  labels, consent, and primary action are preserved.
- Chrome's local Vite run records Cognito's existing third-party
  `insertBefore` exception while its seamless form initializes; the form still
  loads and the app emits its successful form-loaded event. No app-owned error
  or visible failure was found.
- No actionable P0, P1, or P2 visual mismatch remains.

## Automated checks

- `npm run lint`: passed (217 source files).
- `npm run build`: passed.
- `git diff --check`: passed.

final result: passed

---

# Vital Ice Visit Details Removal

## Visual truth and capture state

- User-selected removal target:
  `.context/attachments/XvS5sw/Screenshot 2026-08-20 at 3.24.39 AM.png`
  (`1074 × 1244` physical pixels), showing the complete Visit Details card.
- Same-state desktop baseline before removal:
  `.context/qa/vitalice-treatment-live-desktop-1024x900.png`
  (`1009 × 1458` captured pixels from a `1024 × 900` Chrome CSS viewport).
- Browser-rendered desktop implementation after removal:
  `.context/qa/vitalice-no-visit-details-desktop-1024x900.png`
  (`1009 × 1458` captured pixels from a `1024 × 900` Chrome CSS viewport).
- Browser-rendered mobile implementation after removal:
  `.context/qa/vitalice-no-visit-details-mobile-390x844.png`
  (`375 × 1582` captured pixels from a `390 × 844` Chrome CSS viewport).
- Full-view normalized comparison:
  `.context/qa/vitalice-remove-visit-details-comparison.png` (before left,
  corrected implementation right).
- Density normalization: baseline and implementation were captured from the
  same Chrome surface, CSS viewport, and device density and have identical
  pixel dimensions, so no scaling was required.
- State: `/vitalice`, Cognito form loaded, no patient information entered, and
  treatment dropdown reset to its placeholder.
- A separate focused-region comparison was not needed because the removed card
  and the re-centered primary form are both clearly readable in the normalized
  full-page comparison.

## Findings, correction, and post-fix evidence

- [P1 resolved] The user-selected Visit Details card remained visible beside
  the booking form. The entire card, its metadata grid, supporting copy, and
  component data were removed.
- [P2 resolved] Removing the second desktop column would have left the booking
  form visually stranded at the left edge. The form now uses a centered
  `max-w-2xl` container: `672px` wide at the desktop QA viewport and `343px`
  wide on mobile.
- Fonts and typography: the co-brand ribbon, Avalon lockup, START heading,
  form labels, input typography, and consent copy remain unchanged.
- Spacing and layout rhythm: the header-to-card gap remains unchanged; the
  primary card is centered with balanced glacier space on both sides and no
  horizontal overflow at either tested viewport.
- Colors and visual tokens: the cream card, espresso CTA and ribbon, teal
  accent, borders, radii, and shadows remain unchanged.
- Image quality and asset fidelity: the original Vital Ice glacier asset,
  crop, sharpness, and full-viewport treatment remain unchanged.
- Copy and content: only the user-selected Visit Details card copy was removed.
  Appointment, treatment, payment, consent, and co-brand copy remain intact.
- Primary interaction check: selected `Myers' Cocktail IV — $275`, verified the
  value, and reset the dropdown without submitting. Date remained visibly set
  to `08/20/2026`, time to `07:00 AM`, and the 60-day date maximum to
  `10/19/2026`.
- Console check: no new first-party error resulted from this change. The local
  development session retained the pre-existing React `fetchPriority` warning
  and Cognito `seamless.js` reload warning documented by earlier QA.
- No actionable P0, P1, or P2 issue remains.

## Comparison history

- Pass 1 identified the requested card and the desktop imbalance that direct
  removal would create.
- Pass 2 removed the card, collapsed the two-column layout, centered the form,
  and confirmed the corrected desktop and mobile compositions in Chrome.

## Automated checks

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:front-door`: passed.
- `npm run test:privacy`: passed.
- `npm audit --omit=dev --audit-level=high`: passed with only two existing
  moderate React Router advisories and no high-severity finding.
- `git diff --check`: passed.

final result: passed

---

# Vital Ice Treatment Dropdown and Appointment Control Visibility

## Visual truth and capture state

- Source visual truth:
  `.context/attachments/Hlgcsp/Screenshot 2026-08-20 at 2.37.02 AM.png`
  (`112 × 548` pixels), a focused mobile crop showing the date and time
  controls collapsed into blank thin lines beneath the standard inputs.
- Browser-rendered mobile implementation:
  `.context/qa/vitalice-treatment-mobile-390x844.png` (Chrome CSS viewport
  `390 × 844`; captured content `375 × 812`).
- Browser-rendered desktop implementation:
  `.context/qa/vitalice-treatment-desktop-1024x900.png` (Chrome CSS viewport
  `1024 × 900`; captured content `1009 × 887`).
- Focused side-by-side comparison:
  `.context/qa/vitalice-treatment-comparison.png` (`595 × 866`; reported crop
  left, corrected mobile form right).
- Density and crop normalization: the source crop was scaled proportionally to
  the mobile implementation capture height (`812px`) before both were joined;
  the source was not stretched or reframed.
- State: `/vitalice`, Cognito form loaded, date/time defaults visible,
  Treatment Menu unselected with its prompt visible, cream/glacier theme.

## Findings, correction, and post-fix evidence

- [P1 resolved] Appointment Date and Appointment Time rendered as blank,
  approximately `22px`-high native controls in the supplied mobile crop. Both
  now use the exact `61px` control height used by name, mobile, and email, with
  left-aligned visible values (`08/20/2026` and `07:00 AM` in the captured
  state), full borders, radii, and calendar/clock affordances.
- [P1 resolved] The old three-item Vital Ice offer was not the current Avalon
  catalog and did not create a treatment choice in the appointment entry. The
  protected required Cognito Choice field now contains 23 current primary IV,
  NAD+, and CBD treatments. Every current `$250` IV is listed at `$275`.
- [P2 resolved] The new native select initially inherited a shorter Cognito
  control. It now matches the standard `61px` field height on desktop and
  mobile and exposes the `Choose a treatment` prompt.
- Fonts and typography: existing Avalon label tracking, body font, weights,
  line heights, and uppercase hierarchy are preserved.
- Spacing and layout rhythm: all six controls share the same height and card
  inset; date/time stay side-by-side on desktop and stack on mobile. No
  horizontal overflow is present at either verified viewport.
- Colors and visual tokens: cream input fill, espresso text, muted prompt,
  hairline border, focus border, and glacier backdrop remain mapped to the
  existing front-door tokens.
- Image quality and asset fidelity: the supplied glacier image, crop, and
  co-brand assets are unchanged.
- Copy and content: the obsolete `$120/$160/$60` offer list is removed. The
  Visit Details card explains that the secure form owns the current menu and
  states the `$250 → $275` booking price rule.
- Primary interactions: the treatment dropdown was opened programmatically,
  `Myers' Cocktail IV — $275` was selected and verified, then the field was
  returned to its unselected prompt. No form was submitted.
- Console check: local development logs contain the pre-existing React
  `fetchPriority` warning and Cognito seamless-script `insertBefore` message
  during repeated reloads; the form still loaded and all verified controls
  remained interactive. Production verification remains part of the release
  gate.

## Comparison history

- Pass 1 recorded blank, undersized date/time controls and the obsolete static
  offer menu from the supplied source crop.
- Pass 2 added committed Cognito defaults, hardened native date/time sizing,
  added and sized the protected treatment dropdown, and replaced the obsolete
  offer copy. The combined post-fix comparison shows readable values and
  consistent full-height controls with no remaining P0/P1/P2 mismatch.

## Automated checks

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:front-door`: passed.
- `npm run test:privacy`: passed.
- `npm audit --omit=dev --audit-level=high`: passed with two existing moderate
  React Router advisories; no high-severity production advisory was reported.
- `git diff --check`: passed.

final result: passed

---

# Avalon Beta Events Supplied Hero Photograph

## Visual truth and capture state

- Supplied source photograph:
  `.context/attachments/U29tC8/Screenshot 2026-08-07 at 2.41.56 PM.png`
  (`1638 × 1050` source pixels).
- Production asset:
  `public/images/events/avalon-events-editorial-hero.jpg` (`1478 × 704`,
  JPEG), cropped from the supplied source to the live hero's landscape ratio.
- Browser-rendered implementation:
  `.context/audits/events-polish/implementation-supplied-photo-desktop.jpg`
  (`1842 × 1036`, Chrome CSS viewport `1842 × 1036`, device pixel ratio
  1).
- Focused browser hero evidence:
  `.context/audits/events-polish/implementation-supplied-photo-hero.jpg`
  (`823 × 308` rendered pixels at device pixel ratio 1).
- Combined full-view and focused comparison:
  `.context/audits/events-polish/supplied-photo-compare.html`.
- State: `/events`, desktop cream theme, quote stage on Event details, editors
  closed, entrance motion settled.

## Findings and post-fix evidence

- The Events hero now uses the user's exact supplied Avalon event photograph.
  The left `160px` of the source was removed because it contained gallery UI
  chrome and a carousel arrow rather than photographic content.
- The normalized `1478 × 704` crop preserves the seated guest, Avalon window
  mark, branded event signage, IV bags, attending nurse, and second guest. The
  browser-rendered hero retains the same crop without stretching, softness, or
  compression artifacts.
- Fonts and typography, spacing/layout rhythm, cream/espresso colors and
  tokens, icons, quote controls, event rows, and copy/content remain unchanged.
- At `390 × 844`, the image remains sharp, the subjects stay recognizable,
  and the page has no horizontal overflow.
- Get a quote still advances to Your details. Chrome reported no console errors
  or warnings.
- No actionable P0, P1, or P2 issue remains.

final result: passed

---

# Avalon Beta Events Editorial Polish

## Visual truth and capture state

- Source visual truth:
  `.context/attachments/zy4kBL/Screenshot 2026-08-07 at 2.04.56 PM.png`.
- Browser-rendered implementation:
  `.context/audits/events-polish/implementation-desktop-final.jpg`.
- Full-view comparison:
  `.context/audits/events-polish/compare.html` (source and implementation at
  the same native size).
- Source and implementation are both `1842 × 1036` CSS pixels at device pixel
  ratio 1; no density normalization was required.
- State: `/events`, desktop cream theme, event-detail quote stage, all editors
  closed, entrance motion settled.
- Focused-region comparison was not required because the headline, trust
  points, hero, quote controls, event-card text, dividers, and status pills are
  legible in the full-size views. Both full-size images were also inspected
  separately at native resolution.

## Findings, correction, and post-fix evidence

- [P2 resolved] The first implementation pass used a `108rem` content shell,
  making the hero, quote builder, and two-column event lists visibly narrower
  than the reference. The shell now uses a responsive `120rem` ceiling and
  matches the reference's outer margins and column proportions.
- The implementation retains Avalon's existing global corner header above the
  reference composition. This is an intentional integration difference: the
  supplied visual is a page-only treatment, while the live beta requires the
  established site navigation on every public route.
- The hero photography and synthetic event names differ from the concept while
  preserving its warm private-event art direction, landscape crop, information
  density, and status hierarchy. The smaller cards use existing Avalon event
  photography rather than fabricated logos or third-party event identities.
- Fonts and typography, cream/espresso color tokens, editorial spacing,
  bordered quote controls, icon weight, image quality, copy hierarchy, row
  density, and responsive behavior were checked against the combined evidence.
- No actionable P0, P1, or P2 mismatch remains.

## Browser and interaction verification

- Google Chrome rendered the desktop evidence at `1842 × 1036` and the
  mobile state at `390 × 844`.
- The Where editor opens and accepts `Palm Springs, CA`; opening Guests closes
  the prior editor; selecting `26 – 50` updates the summary.
- Get a quote advances to the `Your details` form and Event details returns to
  the populated first stage.
- The mobile document width equals the viewport width (`390px`), with no
  horizontal overflow, and the quote builder remains present and operable.
- Chrome reported no console errors or warnings.

final result: passed

---

# Start Page Spacing Polish — 2026-08-06

## Visual truth and capture state

- Source visual truth:
  `.context/attachments/CiGqyc/Screenshot 2026-08-06 at 3.46.17 PM.png`
  (`1382 × 938` source pixels).
- Browser-rendered implementation:
  `.context/spacing-polish-qa/start-desktop-final.png` at a `1382 × 938` CSS
  viewport and device pixel ratio 1.
- Full-view comparison evidence:
  `.context/spacing-polish-qa/compare-desktop-final.png` (source left,
  implementation right).
- Focused-region comparison was not required because both full-size captures
  preserve readable header, form, card, map, and step-detail typography.
- State: `/start`, cream theme, menu closed, Cognito form loaded.

## Findings and comparison history

- [P2 resolved] The shipping module was capped at `1024px`, producing inset
  columns and compressed controls. The focused main, shell, and landing grid
  now reproduce the reference's `1216px` content envelope with the exact
  `537px / 139px / 540px` desktop column composition.
- [P2 resolved] The previous desktop-height compression reduced the START
  headline, input rhythm, request rows, and primary button at ordinary laptop
  heights. Full editorial spacing now applies above `820px`; the compact mode
  remains available only for genuinely short desktop windows.
- [P2 resolved] The request card's map began below the coverage copy and its
  step row was padded inward. The map now starts flush with the request rows,
  the coverage panel matches the reference height, and the three steps use the
  full card width.
- [P2 resolved] Header actions were too small and clustered. The focused Start
  header now matches the reference's logo placement, 54px circular controls,
  and 20px control spacing without changing the already-tightened menu panel.
- Post-fix evidence shows matching headline, field, request-row, card, map,
  button, and step baselines. Remaining 1–5px optical differences are P3
  antialiasing/content-rendering variance and require no action.

## Required fidelity surfaces

- Fonts and typography: shipping Bebas Neue, Inter, and IBM Plex Mono are
  preserved; display, form, factual, and step scales match the source.
- Spacing and layout rhythm: outer insets, two-column tracks, input heights,
  consent/help spacing, request rows, coverage height, and step dividers match
  the reference without horizontal overflow.
- Colors and visual tokens: the existing cream canvas, espresso ink, warm
  white inputs, muted text, and hairline borders are unchanged.
- Image quality and asset fidelity: the existing 960 × 1166 Bay Area map is
  retained at native quality with the source-matched crop and opacity.
- Copy and content: all form, consent, request, service-area, and three-step
  copy remains unchanged.

## Implementation checklist

- [x] Expand the focused desktop shell and equalize the two primary columns.
- [x] Restore full desktop form spacing while preserving short-window mode.
- [x] Match request-row, map, coverage-copy, and step geometry.
- [x] Match focused-header control spacing without widening the menu panel.
- [x] Preserve the subtle mobile coverage treatment.

## Follow-up polish

- No actionable P0, P1, or P2 visual mismatch remains.

final result: passed

---

# Start Page Bay Area Coverage + Corner Menu Polish — 2026-08-06

## Visual truth and capture state

- Desktop source visual truth:
  `.context/service-area-map-previews/entire-bay-area-desktop.png`
  (`1586 × 992` source pixels).
- Mobile source visual truth:
  `.context/service-area-map-previews/entire-bay-area-mobile-subtle.png`
  (`853 × 1844` source pixels).
- Corner-menu density reference:
  `.context/attachments/7cMX9F/Screenshot 2026-08-06 at 9.51.10 AM.png`
  (`650 × 492` source pixels).
- Browser-rendered desktop implementation:
  `.context/polish-qa/start-desktop-final.png` at a `1440 × 1024` CSS viewport,
  device pixel ratio 1.
- Browser-rendered mobile implementation:
  `.context/polish-qa/start-mobile-final.png` at a `390 × 844` CSS viewport,
  device pixel ratio 1.
- Browser-rendered menu implementation:
  `.context/polish-qa/menu-mobile.png` at a `390 × 844` CSS viewport,
  device pixel ratio 1.
- Combined comparison evidence:
  `.context/polish-qa/compare-desktop-final.png`,
  `.context/polish-qa/compare-mobile-final.png`, and
  `.context/polish-qa/compare-menu.png`.
- State: `/start`, cream consumer theme, Cognito form loaded; menu closed for
  coverage captures and open for the menu capture.

## Findings and comparison history

- [P2 resolved] The first mobile concept made service coverage a dominant
  full-width section and pushed the booking task down. The implementation uses
  a 28.8px-high mono trust line with a library map icon and the exact copy
  `Serving the entire Bay Area`; the form begins immediately beneath it.
- [P2 resolved] The corner navigation in the supplied screenshot occupied most
  of the available width with oversized rows. The implementation measures
  `228 × 194px` at 390px, with four consistent 48px touch rows. It is visibly
  narrower and denser while preserving accessible tap targets.
- [P2 resolved] The generated desktop concept used a stylized geographic fill.
  The implementation replaces it with a real public-domain Bay Area map derived
  from Census TIGER/Line geography, while preserving the approved headline and
  five-region proof line. The map loads at `960 × 1166` natural pixels and is
  rendered with the approved restrained monochrome treatment.
- [P3 accepted] The mobile mock shows a bespoke geographic outline; production
  uses the closest matching icon-library map glyph at small size. At this scale
  the explicit coverage text carries meaning more reliably than detailed
  coastline geometry.
- [P3 accepted] The shipping global header retains the existing text/call
  controls visible in the original site reference. Removing them was outside
  the selected coverage and menu-polish scope.

## Required fidelity surfaces

- Fonts and typography: shipping Bebas Neue, Inter, and IBM Plex Mono voices are
  preserved. Coverage follows LOUD headline + TRUE/mono fact hierarchy.
- Spacing and layout rhythm: desktop coverage remains inside the existing
  request card; mobile adds less than 29px and preserves the one-column booking
  rhythm. No horizontal overflow at either verified viewport.
- Colors and visual tokens: cream canvas, warm-black ink, muted fact text, and
  hairline borders use existing consumer tokens; no new accent color or shadow
  language was introduced.
- Image quality and asset fidelity: desktop uses a real 960px map raster, not
  CSS art or generated geography. It is fully loaded in the browser capture.
- Copy and content: `The entire Bay Area, covered`, all five named regions, and
  `Serving the entire Bay Area` render exactly. Existing form and consent copy
  is unchanged.

## Browser and interaction checks

- Menu opens from the unique `Open menu` control, exposes all four navigation
  links, and closes with Escape while returning the `Open menu` state.
- Cognito name, mobile, and email fields plus consent and START controls are
  present in the mobile DOM snapshot.
- Desktop map asset reports complete with non-zero natural dimensions.
- Chrome console error scan: clean on desktop and mobile captures.
- Desktop document width: `1440 / 1440`; mobile: `390 / 390` (no overflow).

## Implementation checklist

- [x] Replace the desktop AREA row with the coverage composition.
- [x] Add the subtle mobile coverage trust line.
- [x] Tighten the corner menu width, row height, type size, and offset.
- [x] Preserve 48px mobile tap targets and keyboard dismissal.
- [x] Run build, lint, responsive browser checks, and console scan.

## Follow-up polish

- No actionable P0, P1, or P2 visual mismatch remains. Remaining P3 deviations
  are intentional production adaptations noted above.

final result: passed

---

# Snooches Homepage Headline, Spacing, and Privacy Controls

## Visual truth and capture state

- Homepage source visual truth:
  `.context/attachments/hTa9mh/Screenshot 2026-07-31 at 1.58.21 PM.png`
  (`2070 × 1306` physical pixels, normalized to a `1035 × 653` CSS
  viewport at device pixel ratio 2).
- Privacy-content reference:
  `.context/attachments/7BkD1h/Screenshot 2026-07-31 at 2.06.23 PM.png`.
  Its control set and information depth were used without adopting its red and
  white styling.
- Browser-rendered homepage:
  `.context/snooches-homepage-sizing-final-1035x653.png`.
- Combined comparison:
  `.context/snooches-homepage-sizing-comparison.png` (source left, corrected
  implementation right).
- Privacy states:
  `.context/snooches-cookie-notice-desktop.png`,
  `.context/snooches-cookie-preferences-desktop.png`, and
  `.context/snooches-cookie-notice-mobile-390x844.png`.
- Homepage comparison state: cookie consent resolved, menu closed, and motion
  settled.

## Findings, correction, and post-fix evidence

- [P2 resolved] The desktop headline was undersized and read as one line. It is
  now the dominant two-line element, with ink bands aligned to the reference:
  target line one `x=61–325.5, y=132.5–193`; implementation
  `x=63–328, y=132–195`. Target line two `x=63.5–346.5, y=208–267.5`;
  implementation `x=65–347, y=208–269`.
- [P2 resolved] The hero moved from an image-light `61/39` composition to the
  reference's balanced editorial/photo split (approximately `51/49`) while
  preserving the existing nurse image asset.
- [P2 resolved] The primary START slab was reduced to the reference's compact
  footprint: target approximately `370 × 79px`; implementation approximately
  `368 × 76px`, with the open arrow ring and existing interaction retained.
- [P2 resolved] The helper row now uses content-width links with the reference
  icon scale, spacing, and hairline separation.
- [P2 resolved] The homepage desktop press rail no longer begins at a visually
  arbitrary marquee offset. It uses a stable six-logo row on first paint;
  other pages and the mobile homepage retain the existing marquee behavior.
- The privacy notice now explains essential and optional analytics cookies in
  fuller language and presents `Accept all`, `Manage preferences`, and
  `Reject all`. Preferences expose essential cookies as always active and a
  saved optional analytics choice. The existing Avalon cream palette, consent
  storage key, consent-change event, homepage-only scope, and delayed display
  behavior are preserved.
- The privacy card fits without internal clipping at `390 × 844`; the
  desktop notice and preferences states were also click-tested.
- Navigation, START, helper links, menu behavior, and footer content remain
  unchanged. Browser console output was clean in the verified homepage state.
- Fonts/typography, spacing/layout rhythm, colors/tokens, image quality, and
  copy/content were checked against the combined comparison. No actionable P0,
  P1, or P2 mismatch remains for the requested sizing, spacing, headline
  emphasis, press alignment, or privacy controls.

## Automated checks

- `npm run lint`: passed (212 files).
- `npm run build`: passed.
- `npm run test:visual`: passed.
- `MOBILE_QA_ROUTES=/,/start MOBILE_QA_WIDTHS=390,430 npm run test:mobile`:
  passed 4/4.
- `npm run test:accessibility`: passed 500/500.
- `npm run assets:audit`: passed; only two pre-existing oversized bag renders
  were reported.
- `git diff --check`: passed.

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

---

# Snooches Desktop Headline and Press-Rail Correction

## Visual truth and capture state

- Source visual truth:
  `.context/attachments/LkJ2ch/Screenshot 2026-07-30 at 10.17.47 AM.png`
  (`2560 × 1420` physical pixels, normalized to a `1280 × 710` CSS viewport at
  device pixel ratio 2).
- Browser-rendered implementation:
  `.context/snooches-headline-press-corrected-1280x710.png`.
- Full-view comparison:
  `.context/snooches-headline-press-comparison.png` (reported live state left,
  corrected implementation right).
- Focused comparison was not required because the headline scale and press-rail
  boundary remain clearly readable in the normalized full-view comparison.
- State: `/`, cookie consent resolved, menu closed, entrance motion settled,
  desktop cream theme.

## Findings, correction, and post-fix evidence

- [P2 resolved] The desktop headline resolved near `57px` and read too large.
  The homepage-only desktop override now resolves it near `48.5px` at the
  reference viewport, a reduction of approximately 15%.
- [P2 resolved] The inherited `34rem` hero minimum overrode the viewport-based
  height and placed the press rail around `39px` below its natural fold
  position. A homepage-only `29.5rem` minimum lets the existing calculated hero
  height win, moving the entire rail upward in normal document flow while
  preserving its full `7.4rem` height and marquee behavior.
- The corrected comparison preserves the full-bleed cream canvas, header,
  image, START slab, helper links, logo artwork, colors, copy, and existing
  interactions.
- `974 × 618`: rail begins at `558px`, headline resolves to `48px`, and there is
  no horizontal overflow.
- `1440 × 900`: rail begins at `792px`, headline resolves near `54.6px`, and
  there is no horizontal overflow.
- `405 × 854`, plus automated `390px` and `430px` checks: the desktop rule is
  inactive; mobile typography, image, cards, and moving press track are
  unchanged.
- Fonts/typography, spacing/layout rhythm, colors/tokens, image quality, and
  copy/content were checked against the combined evidence. No actionable P0,
  P1, or P2 mismatch remains.

## Automated checks

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:visual`: passed.
- `MOBILE_QA_ROUTES=/ MOBILE_QA_WIDTHS=390,430 npm run test:mobile`: passed 2/2.
- `git diff --check`: passed.

final result: passed

---

# Snooches Start Page Centering and Control Removal

## Visual truth and capture state

- Source visual truth:
  `.context/attachments/4KX7PM/Screenshot 2026-07-30 at 10.29.38 AM.png`
  (`2560 × 1420` physical pixels, normalized to a `1280 × 710` CSS viewport at
  device pixel ratio 2).
- Control-removal reference:
  `.context/attachments/NHYI7h/Screenshot 2026-07-30 at 10.37.37 AM.png`.
- Browser-rendered implementation:
  `.context/snooches-start-centered-1200x683.png`.
- Combined comparison:
  `.context/snooches-start-centered-comparison.png` (reported state left,
  corrected implementation right).
- State: `/start`, menu closed, form loaded, desktop cream theme.

## Findings, correction, and post-fix evidence

- [P2 resolved] The `1024px` booking module was already horizontally centered,
  but its visible envelope began at approximately `80px`, leaving the module
  visually pinned beneath the fixed header. The desktop-only page grid now
  reserves the `86px` header and centers the module within the remaining
  viewport height.
- At the verified `1200 × 683` live viewport, the module measures `1024px`
  wide at `x=88px` and spans `y=144.48px` through `624.91px`. Its midpoint
  matches the usable area below the header to within one pixel.
- The page reports zero vertical overflow at the verified viewport.
- Removed the focused-booking shortcut row containing `Help me choose`,
  `View full menu`, and `Call (415) 980-7708`, as shown in the control-removal
  reference. The full form and request rail remain intact.
- The desktop header, typography, cream canvas, form fields, request summary,
  three-step explanation, and existing form behavior are unchanged.
- Automated `390px` and `430px` checks confirm that the desktop-only centering
  rule does not change the mobile layout.
- Fonts/typography, spacing/layout rhythm, colors/tokens, image quality, and
  copy/content were checked against the combined evidence. No actionable P0,
  P1, or P2 mismatch remains.

## Automated and live checks

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:visual`: passed.
- `MOBILE_QA_ROUTES=/start MOBILE_QA_WIDTHS=390,430 npm run test:mobile`:
  passed 2/2.
- Live alias resolves to deployment `dpl_9uQZcz4FVtBbHmVKcArN5cBKjRCb`
  with status `READY`; preview and live CSS asset hashes match.
- Post-deploy error scan: clean.

final result: passed

---

# Avalon Beta Events Disclaimer Removal

## Visual truth and capture state

- User removal reference:
  `.context/attachments/H2l362/Screenshot 2026-08-07 at 2.28.27 PM.png`
  (`776 × 48` source pixels), identifying the exact sentence to remove.
- Parent Events reference:
  `.context/audits/events-polish/reference.png` (`1842 × 1036`).
- Browser-rendered implementation:
  `.context/audits/events-polish/implementation-disclaimer-removed-1842.jpg`
  (`1842 × 1036`, Chrome CSS viewport `1842 × 1036`, device pixel ratio
  1).
- Full-view comparison:
  `.context/audits/events-polish/disclaimer-removal-compare.html`.
- State: `/events`, desktop cream theme, quote stage on Event details, editors
  closed, entrance motion settled.
- A separate focused-region comparison was not required because the user
  supplied the exact text crop, and the sentence's absence plus the resulting
  quote-card spacing are clearly readable in the same-size full-view
  comparison.

## Findings and post-fix evidence

- The sentence `Transparent pricing. Nothing medical is asked here.` is absent
  from the component, browser text tree, and rendered quote card.
- Removing the sentence lets the quote card close immediately below the
  controls without leaving an empty row, clipping the CTA, or disturbing the
  two event columns.
- Fonts and typography, spacing/layout rhythm, cream/espresso tokens, hero and
  event-image quality, and all remaining copy/content were checked. They remain
  unchanged apart from the requested removal.
- At `390 × 844`, document width equals viewport width, the sentence remains
  absent, and Get a quote still advances to Your details.
- Chrome reported no console errors or warnings.
- No actionable P0, P1, or P2 issue remains.

final result: passed

---

# Vital Ice Top-Spacing Balance

## Visual truth and capture state

- Source visual truth:
  `.context/attachments/tBakBj/Screenshot 2026-08-20 at 2.20.53 AM.png`
  (`2322 × 564` physical pixels, including 32 pixels of browser chrome).
- Browser-rendered desktop implementation:
  `.context/qa/vitalice-balanced-desktop-1024x235.png` (Chrome CSS viewport
  `1024 × 235`; captured content `1009 × 232`).
- Browser-rendered mobile implementation:
  `.context/qa/vitalice-balanced-mobile-390x844.png` (Chrome CSS viewport
  `390 × 844`).
- Full-view comparison:
  `.context/qa/vitalice-spacing-comparison.png` (reported source left,
  corrected implementation right).
- Density normalization: the 32-pixel browser strip was removed from the
  source, then its app-owned region was normalized to the implementation's
  `1009 × 232` capture before both images were joined in one comparison.
- State: `/vitalice`, form loaded, desktop and mobile cream/glacier theme.
- A separate focused-region comparison was not needed because the requested
  change is limited to the two clearly visible vertical gaps surrounding the
  co-brand ribbon; ribbon content and the opening card edges remain readable in
  the full-view comparison.

## Findings, correction, and post-fix evidence

- [P2 resolved] The source showed approximately `112px` above the co-brand
  ribbon but only `40px` between the ribbon and the cards, making the page feel
  top-heavy. The page inset now uses the same rhythm as the following section
  gap: `40px / 40px` at desktop and `32px / 32px` on mobile.
- The correction moves the ribbon and both cards upward without changing their
  width, height, internal padding, grid tracks, border radii, or shadow.
- Fonts and typography: the Vital Ice lockup, Avalon wordmark, START heading,
  label tracking, weights, and line heights are unchanged.
- Spacing and layout rhythm: the desktop ribbon begins at `40px` and ends at
  `128px`; the card grid begins at `168px`. Mobile uses a `32px` top inset and
  a `32px` ribbon-to-card gap. No horizontal overflow is present.
- Colors and visual tokens: the espresso ribbon, cream cards, teal accents,
  borders, and foreground colors are unchanged.
- Image quality and asset fidelity: the supplied glacier image, crop,
  sharpness, and fixed full-viewport treatment are unchanged.
- Copy and content: all Vital Ice, Avalon, treatment-menu, appointment, pricing,
  consent, and form copy remains unchanged.
- Primary interaction check: the Cognito form loaded and its native date and
  time controls remained visible. No form was submitted.
- Console check: no app error appeared on the production baseline. Cognito
  continues to emit its existing third-party null-date warning before a date is
  selected; this predates and is unrelated to the spacing correction.
- No actionable P0, P1, or P2 visual mismatch remains.

## Comparison history

- Pass 1 found the top inset at `112px` versus the next section gap at `40px`.
- Pass 2 reduced the responsive top inset to the existing section rhythm and
  confirmed exact `40px / 40px` desktop and `32px / 32px` mobile spacing in the
  post-fix browser captures.

## Automated checks

- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:front-door`: passed.
- `npm run test:privacy`: passed.
- `npm audit --omit=dev --audit-level=high`: passed.
- `git diff --check`: passed.

final result: passed

---

# Start Appointment Apple-Quality Mobile Polish

## Visual truth and capture state

- Production baseline: `.context/qa/start-apple-baseline-390x844.png`
  (Chrome CSS viewport `390 × 844`, current live `/start`).
- Browser-rendered implementation:
  `.context/qa/start-apple-after-390x844.png` (Chrome CSS viewport
  `390 × 844`, local corrected `/start`).
- Full-view comparison:
  `.context/qa/start-apple-before-after-390x844.png` (production baseline
  left, corrected implementation right).
- Focused appointment/legal comparison:
  `.context/qa/start-apple-focused-before-after.png` (equal `390 × 414`
  crops from `y=430`, baseline left and corrected implementation right).
- Additional implementation captures:
  `.context/qa/start-apple-after-393x852.png` and
  `.context/qa/start-apple-after-320x568.png`.
- State: resolved cookie choice, live Cognito values present, no patient data
  entered, no form submitted, cream theme.

## Findings, correction, and post-fix evidence

- [P1 resolved] The mobile appointment spacing selector targeted Cognito's
  desktop `.el-date-editor` wrapper, but Cognito renders bare native
  `input[type='date']` and `input[type='time']` controls on iPhone-size
  viewports. The intended rhythm therefore never applied. The corrected
  selector targets the actual native controls.
- [P1 resolved] WebKit's picker indicator participated in the native field's
  inline layout, making `text-align:center` insufficient on iPhone. The native
  indicator is now removed from text flow and pinned to a measured 16px
  trailing inset; the date/time value wrapper uses a full-width centered flex
  layout with tabular numerals.
- [P2 resolved] The cookie shortcut was explicitly overridden into the upper
  right of focused-booking mobile pages and its 52px child was compressed by a
  36px parent. It now uses a true 44 × 44px touch target in the bottom-left
  safe area. Supporting legal copy reserves a 56px rail so button and text do
  not overlap. On the shortest 320 × 568 viewport, cookie and START share a
  separate 44px action row with a 12px gap.
- On `390 × 844` and `393 × 852`, the measured rhythm is 8px from each label
  to its control and 16px between date and time groups. Both controls are
  52px high, equal-width, center-aligned, and retain visible defaults
  `2026-08-20` and `08:00`.
- On `375 × 667`, the compact rhythm is 6px / 12px with 44px controls. On
  `360 × 640` and `320 × 568`, the existing no-scroll compact contract remains
  intact with all core fields, consent, and START available.
- Every tested phone reports `scrollHeight === clientHeight`, zero horizontal
  overflow, and no visible Cognito validation errors.
- Cookie preferences interaction: the bottom-left button opens a `312 × 375`
  popover fully inside the `393 × 852` viewport, anchored above the button;
  close interaction works and no horizontal overflow appears.
- Cognito loading remains atomic. A 25ms sample showed the complete skeleton
  until date, time, checkbox, and button were all present, then one swap to the
  complete native form.
- Desktop `1280 × 900` now correctly uses the intended two-column appointment
  row: equal `260.5px` controls, aligned tops and heights, centered visible
  values, and no horizontal overflow.
- Vital Ice regression check: its 24-option treatment menu, date, time, and
  START button load; the native form is visible and date/time remain centered.
- Fonts and typography retain Avalon families and hierarchy; only numeric
  appointment values gain tabular spacing. Colors, radii, borders, shadows,
  icons, imagery, and all app copy remain on the existing design system.
- No actionable P0, P1, or P2 visual mismatch remains.

## Comparison history

- Pass 1 reproduced the cramped production rhythm and top-right cookie
  control, then identified the non-matching `.el-date-editor` mobile selector.
- Pass 2 applied the correct native-input selector but exposed Cognito flex
  growth as a large blank gap; the appointment row was changed to an explicit
  single-column grid with intrinsic children.
- Pass 3 established the 8/16px modern-iPhone rhythm, 6/12px compact-iPhone
  rhythm, bottom-left cookie rail, and shortest-screen action row. Full and
  focused comparisons show aligned controls and clear legal copy.

## Automated checks

- `git diff --check`: passed.
- `npm run lint`: passed (217 source files).
- `npm run build`: passed.
- `npm run test:front-door`: passed.
- `npm run test:privacy`: passed.
- `npm audit --omit=dev --audit-level=high`: passed; two existing moderate
  React Router advisories remain below the requested threshold.

final result: passed

---

# Global Mobile Footer Polish

## Visual evidence

- Source reference:
  `.context/attachments/Fnv6aH/Screenshot 2026-08-20 at 9.56.55 AM.png`
  (`550 × 620` source pixels).
- Browser-rendered implementation:
  `.context/qa/mobile-footer-implementation-final-touch-390x844.png` (`375 × 591`
  captured footer pixels from a Chrome CSS viewport of `390 × 844`; desktop
  Chrome's scrollbar leaves a `375px` content width; device scale factor 1).
- Full-view comparison:
  `.context/qa/mobile-footer-reference-vs-final-touch.png` (reference left,
  implementation right).
- State: public home page at the footer, all accordion rows collapsed, cookie
  choice resolved, no personal data entered. The source is already a focused
  footer crop, so the full-view comparison also supplies the readable focused
  evidence for typography, icons, dividers, and spacing.

## Findings, correction, and post-fix evidence

- [P1 resolved] Public routes had several route-local footer implementations,
  producing visual drift and leaving some pages without the requested mobile
  treatment. A single global mobile footer now renders on every public
  consumer route while the original route footers remain the desktop source.
- [P2 resolved] The existing mobile footer lacked the reference's bordered
  three-row accordion, Clock icon, ruled contact rows, centered bare social
  icons, and rounded cream panel. These surfaces now match the supplied image's
  grouping, order, border rhythm, and alignment.
- [P2 resolved] The first comparison exposed `37.6px` social touch targets.
  Their invisible hit areas are now exactly `44 × 44px` without changing the
  small, visually centered icons.
- [P2 resolved] The broad mobile audit then exposed `36px` email and phone
  interaction rows at the tablet breakpoint. All four contact rows are now
  consistently `44px` high; the linked rows meet the same Apple-sized target
  standard as the social controls.
- Typography keeps Avalon's existing display/body system and follows the
  reference hierarchy. Spacing, cream/dark tokens, one-pixel rules, and large
  lower corner radii match the source. Copy matches the reference, including
  email, phone, service area, hours, copyright, and medical disclaimer.
- No raster image asset appears in this footer target. The implementation uses
  the project's existing Lucide and React Icons libraries for the reference's
  mail, phone, map, clock, Instagram, Facebook, Google, and Yelp glyphs; no
  placeholder or fabricated visual asset was introduced.
- Accordion interaction was verified open and closed; Services exposes Start,
  Menu, and Events. A clean home-page browser tab logged zero warnings or
  errors.
- Focused mobile route verification passed on `/`, `/protocols`,
  `/privacy-policy`, `/b2b`, and `/careers`, with exactly one visible global
  footer and zero horizontal overflow. The broad route suite was also
  exercised at `320`, `375`, `390`, `430`, and `768px` widths.
- `/start`, `/vitalice`, event kiosk, and event board intentionally exclude the
  global footer so their focused/no-scroll workflows remain intact. `/start`
  still fits `390 × 844` without scrolling and retains visible current date
  and time values.
- Desktop checks at `1280 × 900` preserve the existing home, legal, and B2B
  footer implementations with the global mobile footer hidden.
- Compact `320 × 568` verification reports no horizontal overflow, exact
  `44 × 44px` social targets, and no cookie-notice overlap.
- No actionable P0, P1, or P2 visual mismatch remains.

## Comparison history

- Pass 1 established the grouped accordion, contact rules, icon sequence,
  centered socials, legal copy, and rounded panel, then identified undersized
  social hit targets in the browser measurement.
- Pass 2 enlarged the invisible social interaction areas to `44 × 44px` and
  exposed the two `36px` linked contact rows in the broad audit.
- Pass 3 established consistent `44px` contact rows and re-captured the final
  side-by-side comparison. Visual hierarchy and source fidelity remain intact
  while every footer link meets the target-size standard.

## Automated checks

- `git diff --check`: passed.
- `npm run lint`: passed (218 source files).
- `npm run build`: passed, including the B2B and 149 SEO outputs.
- `npm run test:front-door`: passed (8 client-gated routes, 25 server-gated
  handlers, single Cognito CSP grant).
- `npm run test:privacy`: passed (11 tracked browser storage keys).
- `npm audit --omit=dev --audit-level=high`: passed at the requested threshold;
  two existing moderate React Router advisories require a breaking major
  upgrade and remain out of scope.
- The first unscoped `npm run test:mobile` invocation accidentally targeted a
  stale server on port 4173 and reached its proxy/firewall error document. The
  scoped run used `MOBILE_QA_BASE_URL=http://127.0.0.1:4181` against this
  implementation. It exercised the complete route matrix without blank pages
  or footer overflow, and identified the now-resolved footer contact targets;
  the legacy suite remains red for existing non-footer targets (including the
  thin `Start your visit` utility link) and existing Cognito/B2B console noise.

final result: passed
