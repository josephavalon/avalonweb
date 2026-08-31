# Nurse Route Design QA

- Source visual truth: `/Users/josephmbp/.codex/generated_images/019ffc19-637c-7683-969c-dc74e9a24039/exec-0690f1fa-8bf5-4b6d-ae1c-c809c33a3190.png`
- Implementation screenshot: `/Users/josephmbp/conductor/workspaces/avalonweb/vilnius/.context/nurse-route-live-full-390-v3.png`
- Route/state: `/provider/shift`, Home origin, four selected Bay Area appointments, Live Mission active leg
- Browser/CSS viewport: 390 × 844, device pixel ratio 1
- Source pixels: 853 × 1844
- Implementation capture pixels: 375 × 1542; browser-reported document height 1580 CSS px. The Chrome capture backend excludes its 15 px scrollbar gutter. Both images were displayed together and normalized by content width for comparison.

## Findings

No actionable P0/P1/P2 findings remain.

- Fonts and typography: the display hierarchy uses the existing Bebas Neue heading token and Inter UI token. The large action, condensed stop times/names, tracked labels, weights, and wrapping now follow the source hierarchy. The implementation keeps 12 px as the mobile readability floor where the source uses smaller optical labels.
- Spacing and layout rhythm: the implementation preserves the source sequence—origin, next action, arrival metrics, active appointment, primary action, stop timeline, and map—with narrow monochrome dividers and consistent horizontal gutters. The source and implementation have different source-image aspect ratios, so comparison used the complete scroll surface rather than treating the source as an exact 390 × 844 crop.
- Colors and tokens: the active route is strictly black, white, and neutral gray. Status is expressed with outline, type weight, and text. No semantic green is used on the new nurse route surfaces.
- Image quality and asset fidelity: there are no raster hero/decorative assets in the source. The implementation uses the real Avalon mark, library icons, and an interactive Mapbox GL JS map. In local demo mode the route line is explicitly labeled estimated/stale; production uses Mapbox Directions traffic geometry when enabled.
- Copy and content: fixed appointment order, 15-minute target, active appointment, route state, and stale ETA language are coherent. The final screenshot is intentionally in a late state because it was captured after the fixed 9:00 AM appointment; the source's “13 min early” is dynamic data, not static copy.
- Icons and controls: origin, location, navigation, overview, back, zoom, and Apple Maps handoff controls are present and use a consistent stroke icon family.
- Responsiveness/accessibility: the focused flow was exercised at 390 × 844, and repository mobile QA also passed `/provider/shift` at 320 px before the global test browser later lost its local target. Primary controls are semantic buttons, inputs are labeled, and fixed actions meet the 44 px touch floor.

Focused regions inspected: departure hierarchy and arrival metrics; white Start Route action; appointment timeline; active-leg map and external handoff. These regions were inspected separately because their type hierarchy, contrast, and line/map geometry were not readable enough in the first full-view capture.

## Comparison History

### Iteration 1 — blocked

- P1: Live Mission retained the route-builder scroll position, cropping the date, origin, and departure action above the viewport.
- P1: custom Mapbox rendering produced a token/session error and a glyph-style validation error, leaving the map black.
- P1: the primary action inherited the global glass-theme override instead of rendering as the source's high-contrast white action.
- P2: a negative buffer rendered as “-43 min early,” and the full stop sequence was only available in the sheet rather than visible in the mission scroll.
- Evidence: `.context/nurse-route-live-390x844.png`.

Fixes: reset scroll on mission entry; pinned token-independent Mapbox GL JS 1.13 for the custom raster style; removed the glyph-dependent symbol layer; forced the primary action's black/white styles and 62 px height; corrected late/early language; added the fixed stop timeline; restricted the map to the active leg.

### Iteration 2 — passed

- Post-fix evidence: `.context/nurse-route-live-full-390-v3.png`.
- The revised complete view restores the top hierarchy, renders the monochrome map, provides the source-level CTA contrast, reports “46 min late” correctly, and exposes the fixed stop sequence before the active-leg map.

## Primary Interactions Tested

- Omit an eligible visit: Build Route disabled until a reason was selected.
- Restore the omitted visit and build the fixed-order route.
- Open and close Day Overview with all four stops and leave-by details.
- Start Route and confirm the active action advances to Mark Arrived.
- Checked browser console after the Mapbox fixes; no new implementation errors appeared in the revised run.

## Follow-up Polish

- P3: capture a production-token route at an on-schedule morning time for a closer data-state match to the selected source.

final result: passed

---

# Mobile Safari Banner and Cookie Panel Design QA

- Source visual truth:
  - `.context/attachments/65N5R3/IMG_3389.png`
  - `.context/attachments/vpcxGc/IMG_3390.PNG`
- Implementation screenshots:
  - `.context/mobile-header-cookie-fix-safari.png`
  - `.context/mobile-banner-fixed-chrome-390.png`
  - `.context/mobile-banner-production-chrome-390.png`
  - `.context/mobile-cookie-compact-safari-open.png`
  - `.context/mobile-cookie-compact-safari-enabled.png`
  - `.context/mobile-cookie-compact-safari-closed.png`
  - `.context/mobile-strip-restored-cookie-chrome-390.png`
  - `.context/mobile-strip-cookie-resolved-local.png`
  - `.context/mobile-strip-cookie-preferences-local.png`
  - `.context/mobile-strip-cookie-first-visit-preview.png`
  - `.context/mobile-strip-cookie-resolved-preview.png`
  - `.context/mobile-strip-cookies-production-chrome-390.png`
- Focused comparison boards:
  - `.context/mobile-banner-before-after.png`
  - `.context/mobile-banner-final-before-after.png`
  - `.context/mobile-cookie-before-after.png`
- Viewport/state: supplied iPhone Safari captures plus Chrome mobile verification at 320, 390, and 425 CSS px content widths; homepage at the top and after a 576 px scroll; stored essential-only consent with the preferences panel closed, open, and analytics enabled.
- Source pixels: 1320 × 2868 for both iPhone captures. Final Chrome implementation capture: 390 × 813. The final focused board normalizes the source and implementation to a 390 px content width.

## Findings

No actionable P0/P1/P2 findings remain.

- Fonts and typography: the promotional strip is restored below 901 px. Its two labels remain on one line, while iPhone Safari receives a guaranteed status-area reserve before the strip text.
- Spacing and layout rhythm: the ordinary mobile strip is 34.4 px tall and the navigation starts exactly at its lower edge. Normal Safari tabs receive no artificial status-area reserve because the browser already owns that region; only a real `safe-area-inset-top` reported by standalone/full-screen iOS is honored. At 320, 390, and 425 px content widths the header remains aligned with zero horizontal overflow. The preferences panel remains reduced from 352 CSS px to 312 CSS px wide on phones, with tighter internal spacing; desktop dimensions remain unchanged.
- Colors and visual tokens: espresso `#2B211B`, cream `#F6F2EB`, warm borders, and cream text remain unchanged.
- Image quality and asset fidelity: the supplied homepage hero, Avalon mark, and icon-library controls are unchanged and remain sharp. No replacement assets were introduced.
- Copy and content: “Mobile wellness, delivered.” and “Start your visit” are restored in the mobile strip. All consent meaning and controls remain intact—essential cookies always on, analytics optional, cookie policy available, and both essential-only and save actions present.
- Responsiveness/accessibility: the fixed mobile navigation remains at viewport coordinate zero after a 576 px scroll. The popover remains within collision padding, buttons remain usable, and the trigger, toggle, close action, focus behavior, and stored preference contract are unchanged.

Focused regions were required because the broken safe-area text and panel-density change are not legible in a full-page comparison. The focused boards place the supplied mobile evidence and the revised Safari render together at matched content widths.

## Comparison History

### Iteration 1 — blocked

- P1: the announcement occupied the iPhone status safe area, causing “Start your visit” to be clipped and the two announcement items to appear vertically broken.
- P2: the 352 px preferences panel and desktop-scale internal spacing occupied too much of the mobile viewport.
- Evidence: the two supplied iPhone captures.

### Iteration 2 — passed

- The tint band and matching document spacer now include the top safe-area inset.
- The phone-only popover width is 312 px with compact internal spacing and type; `sm` and larger sizes retain the approved desktop panel.
- Post-fix evidence: `.context/mobile-banner-before-after.png` and `.context/mobile-cookie-before-after.png`.

### Iteration 3 — rejected

- The user reported that iPhone Safari still placed native status chrome over the promotional strip because its safe-area environment resolved unreliably in a normal tab.
- Hiding the strip removed the symptom but did not preserve the approved design. The user rejected that change.

### Iteration 4 — passed

- Restored the espresso promotional strip on every public mobile route.
- Added pre-paint iPhone/iPad detection and a 40 px minimum status-area reserve, with `env(safe-area-inset-top)` still used when it is larger. The earlier 60 px fallback was rejected as too tall and reduced to match the supplied iPhone geometry.
- Bumped the blocking theme-bootstrap URL so Safari cannot reuse the pre-fix cached script.
- Chrome mobile verification passed at 320, 390, and 425 px with no horizontal overflow; after a 576 px scroll the strip remains at coordinate zero and the navigation remains directly below it.
- Verified both cookie states: the first-visit consent bar is present, OK replaces it with the 52 px circle, and the circle opens the 312 px compact preferences panel.
- Local evidence: `.context/mobile-strip-restored-cookie-chrome-390.png`, `.context/mobile-strip-cookie-resolved-local.png`, and `.context/mobile-strip-cookie-preferences-local.png`.
- The exact preview artifact passed the same checks, was promoted, and was reopened on `www.avalonvitality.co`. Production serves the cache-busted bootstrap, the strip is visible at 390 px, its navigation remains directly below it, the stored-consent circle is present, and horizontal overflow is absent.
- Deployed evidence: `.context/mobile-strip-cookie-first-visit-preview.png`, `.context/mobile-strip-cookie-resolved-preview.png`, and `.context/mobile-strip-cookies-production-chrome-390.png`.
- Follow-up iPhone evidence at `.context/attachments/e3bEHX/Screenshot 2026-08-20 at 2.23.28 AM.png` revealed the remaining root cause: the global 44 px mobile touch-target minimum applied to the strip link but not its adjacent label, putting their visible text on different baselines. The strip now resets that link-only minimum height and centers it inline; both labels share the same measured top and bottom while the 40 px status reserve and 34.4 px strip height remain unchanged.

## Primary Interactions Tested

- Opened the persistent cookie control in Safari and confirmed the compact popover placement.
- Enabled analytics and confirmed the switch state updates visibly.
- Closed the popover with its close control and confirmed the launcher remains available.
- Verified the restored mobile strip and header in Chrome at 320, 390, and 425 px and after a 576 px scroll.
- Lint, production build, privacy QA, analytics QA, and front-door QA all pass.

final result: passed

---

# Persistent Cookie Preferences Design QA

- Source visual truth:
  - `.context/attachments/8X0GPV/Screenshot 2026-08-16 at 7.57.24 AM.png`
  - `.context/attachments/ja2yil/Screenshot 2026-08-16 at 7.57.53 AM.png`
- Implementation screenshots:
  - `.context/avalon-cookie-control-after-ok.png`
  - `.context/avalon-cookie-preferences-preview.png`
- Focused source/implementation board: `.context/avalon-cookie-preferences-comparison.png`
- State: Safari normal window, stored `cookieConsent=declined`, collapsed launcher and expanded preferences panel

## Findings

- No actionable P0/P1/P2 findings remain.
- The large Cookiebot card is intentionally reduced to a compact 352 px Avalon panel while preserving its anchored bottom-left relationship, dark surface, divided header/body/footer, and clear close action.
- The launcher uses the supplied link-control reference, reduced to a 52 px espresso circle with a real library icon and a cream-on-brown treatment consistent with Avalon’s browser chrome.
- Controls reflect Avalon’s real consent contract rather than inventing unsupported categories: essential cookies are always active and analytics remains a single optional toggle.
- Footer actions are balanced as “Essential only” and “Save preferences”; the cookie-policy link remains available without increasing the card height.
- The panel uses the same `#2B211B` espresso and warm cream system as the approved Safari and cookie-bar work. Typography, separators, corner radii, and button proportions remain legible at the smaller scale.

## Primary Interactions Checked

- Clicking the thin bar’s OK action stores `declined`, removes the measured banner, restores normal page balance, and reveals the persistent circle.
- The circle is a Radix popover trigger with click, keyboard, outside-click, Escape, close-button, focus-entry, and focus-return behavior.
- Opening preferences resets the analytics switch to the stored choice; saving writes `allowed` or `declined` and preserves the existing `avalon:consentChanged` event.
- Essential-only remains available after the first decision, so optional analytics can be withdrawn without clearing site storage manually.
- Public-route presence and authenticated/operational-route suppression remain unchanged.
- The launcher clears the mobile sticky booking action through the existing responsive collision rule.

final result: passed

---

# Safari Chrome and Consent Bar Design QA

- Source visual truth:
  - `.context/attachments/uTwBdv/Screenshot 2026-08-15 at 11.47.03 AM.png`
  - `.context/attachments/eaEmbL/Screenshot 2026-08-15 at 11.55.24 AM.png`
  - `.context/attachments/IZDZ3f/Screenshot 2026-08-15 at 11.57.12 AM.png`
  - `.context/attachments/UmbSD0/Screenshot 2026-08-15 at 11.54.18 AM.png`
  - `.context/attachments/5wN866/Screenshot 2026-08-16 at 7.33.11 AM.png`
  - `.context/attachments/JxnPiF/Screenshot 2026-08-16 at 7.33.55 AM.png`
- Implementation screenshots:
  - `.context/avalon-safari-normal-after-fullscreen-fix.png`
  - `.context/avalon-safari-fullscreen-after-fix.png`
- Full-view Safari comparison: `.context/drip-avalon-fullscreen-comparison.png`
- Focused source/implementation board: `.context/avalon-fullscreen-widget-comparison.png`
- Viewport/state: Safari 26 on macOS 26.3.1, 2560 × 1600 display capture, normal and native macOS full-screen modes, desktop first visit, no stored cookie choice
- Source pixels: full-screen crop 726 × 362; launcher crop 276 × 288; Drip full-screen control 2560 × 1600
- Implementation pixels: 2560 × 1600

## Findings

- No actionable P0/P1/P2 findings remain.
- Normal Safari chrome and the sampled page band use Avalon espresso `#2B211B`; cream remains the app canvas. Light and dark `theme-color` metadata now resolve to the same RGB value, and the public document canvas supplies Safari 26's background-derived fallback.
- Native macOS full-screen Safari intentionally repaints its own toolbar charcoal. A same-machine control capture confirms Drip loses its teal native toolbar in the same mode while retaining its teal in-page banner. Avalon's in-page espresso band likewise remains present. This browser-owned difference is expected, not implementation drift.
- The first-view composition now reserves the measured consent height. The hero remains balanced, both secondary links stay visible, and the complete moving press rail sits in normal document flow immediately above the cookie bar.
- The desktop cookie notice is a compact one-line strip with a 28 px OK control, readable copy, a visible preferences link, and no empty vertical padding.
- The entire concierge mount is removed. The focused before/after board confirms the bottom-right circular launcher is absent without leaving a blank overlay or disturbing the hero crop.
- Fonts/typography, spacing/layout rhythm, colors/tokens, hero image quality, and approved copy remain unchanged from the previously passed normal-window comparison. Focused crops were used because the toolbar tint and launcher removal are not readable in a downscaled full-page board.

## Primary Interactions Checked

- First-visit notice rendering and ResizeObserver height updates.
- Essential-only OK persistence and analytics preference event compatibility.
- Public-route presence and authenticated/operational-route suppression.
- Normal-window espresso chrome, native full-screen transition, and matching top-of-page band.
- Drip and Avalon were captured in the same native full-screen Safari state; both receive Safari's charcoal native toolbar.
- No visible browser error surface appeared in either Avalon capture; production build, lint, privacy QA, and front-door QA pass.

## Comparison History

- Iteration 1: normal-window Safari tint, cookie notice, and concierge passed against the original references.
- Iteration 2: user identified native full-screen toolbar loss and requested launcher removal. The launcher was removed; RGB light/dark metadata and an espresso document-canvas fallback were added. Post-fix evidence confirms the page-owned brown remains and Drip has the same native full-screen toolbar limitation.

final result: passed
