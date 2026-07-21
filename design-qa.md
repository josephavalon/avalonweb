# Navigation Design QA

- Source visual truth:
  - `/Users/josephmbp/conductor/workspaces/avalonweb/vilnius/.context/attachments/8O2d2a/Screenshot 2026-07-21 at 1.16.23 PM.png`
  - `/Users/josephmbp/conductor/workspaces/avalonweb/vilnius/.context/attachments/DTWG54/Screenshot 2026-07-21 at 1.17.10 PM.png`
- Implementation screenshots:
  - `/Users/josephmbp/conductor/workspaces/avalonweb/vilnius/.context/recovery-main-alignment/.context/nav-home-desktop.png`
  - `/Users/josephmbp/conductor/workspaces/avalonweb/vilnius/.context/recovery-main-alignment/.context/nav-menu-desktop.png`
  - `/Users/josephmbp/conductor/workspaces/avalonweb/vilnius/.context/recovery-main-alignment/.context/nav-events-desktop.png`
- Combined comparison evidence: `/Users/josephmbp/conductor/workspaces/avalonweb/vilnius/.context/recovery-main-alignment/.context/nav-qa-comparison.png`
- Viewport: desktop 1440 × 900; mobile 390 × 844.
- State: care-host navigation, top of page, menu closed.

## Findings

No actionable P0, P1, or P2 differences remain.

- Fonts and typography: Home, Menu, and Events all render the same Inter 18px/600 navigation type with 2.16px tracking and uppercase presentation.
- Spacing and layout rhythm: the desktop navigation frame is identical on all three routes at x 28.796875, y 16, width 1382.40625, and height 64. The grid columns, link boxes, padding, and 24px radius are also identical. Mobile uses the same 358 × 56 frame at x 16, y 8 on all three routes.
- Colors and visual tokens: every route uses the same `rgb(3, 3, 3)` surface, border treatment, white foreground, and transparent link underline state.
- Image quality and asset fidelity: the existing Avalon logo asset is retained without substitution or reconstruction.
- Copy and content: the visible link sequence is consistently BOOK, MENU, EVENTS; BOOK retains its Acuity destination.
- Interaction and accessibility: MENU and EVENTS navigation works; no horizontal overflow occurs at 390px; browser console and page-error checks are clean.

Focused comparison was required because the source screenshots isolate the navigation typography and underline state. The combined comparison shows both source mismatches beside the corrected canonical bar.

## Comparison History

### Iteration 1

- Earlier P1 finding: the component applied the canonical `av-home-nav` design only on `/`, so interior routes switched typography, layout rules, and active-link decoration.
- Earlier P2 finding: BOOK was force-highlighted on Home, while interior routes moved the underline to the active route.
- Fixes: apply the canonical navigation class, grid, brand, and mobile treatment on every public route; remove visual underline decoration from all top-menu links while retaining route semantics.
- Post-fix evidence: Home, Menu, and Events desktop captures are visually identical; computed geometry and typography match exactly; all link border widths are `0px` and all `::after` contents are `none`.

## Implementation Checklist

- [x] One canonical top-navigation presentation across public routes.
- [x] No underline beneath BOOK, MENU, or EVENTS.
- [x] BOOK continues to open Acuity.
- [x] MENU and EVENTS navigation tested.
- [x] Desktop and mobile geometry verified.
- [x] Console errors and horizontal overflow checked.

## Follow-up Polish

No P3 follow-ups identified for this scoped change.

final result: passed
