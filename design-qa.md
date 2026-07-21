# Event Hub, Public Event Page, and Event Control — Design QA

## Source visual truth

- `DESIGN.md` — approved Afterglow Clinical system.
- `.context/event-organizer-audit/10-hub-desktop-compliance-final.png` — existing Event Hub design language.
- `.context/attachments/Tmetw8/Screenshot 2026-07-20 at 6.01.22 PM.png` — Event Hub public-page entry point.
- `.context/attachments/YViHzM/Screenshot 2026-07-20 at 6.10.47 PM.png` — public subheadline removal direction.
- `.context/attachments/QqfaEM/Screenshot 2026-07-20 at 6.11.22 PM.png` — admission-note removal direction.
- `.context/attachments/95bpV5/Screenshot 2026-07-20 at 6.12.01 PM.png` — public clinical-panel removal direction.
- `.context/attachments/FnPzdi/Screenshot 2026-07-20 at 6.12.25 PM.png` — public detail-density direction.
- `.context/attachments/gv1AmQ/Screenshot 2026-07-20 at 6.13.28 PM.png` — organizer readiness label direction.
- `.context/attachments/unTrZz/Screenshot 2026-07-20 at 6.14.56 PM.png` — Event Readiness operational-detail direction.
- `.context/attachments/lHNWsw/Screenshot 2026-07-20 at 6.30.26 PM.png` — organizer login false-empty validation failure.
- `.context/event-mobile-followup/01-public-mobile-before.png` — mobile public-page source state where the no-photo artwork displaced event facts and commerce.

## Implementation evidence

- Public desktop: `.context/event-public-admin-audit/09-public-desktop-final.png` at 1440×1000, published demo event.
- Public mobile: `.context/event-public-admin-audit/08-public-mobile-final.png` at 390×844, published demo event.
- Admin desktop: `.context/event-public-admin-audit/14-admin-event-ops-final.png` at 1440×1000, authenticated admin approval and venue-handoff state.
- Admin clinical mobile: `.context/event-public-admin-audit/07-admin-clinical-mobile.png` at 390×844, authenticated clinical-configuration state.
- Organizer final: `.context/event-public-admin-audit/13-organizer-complete-event-ops-final.png` at 1440×1000, authenticated venue, insurance, capacity, and equipment handoff.
- Organizer mobile: `.context/event-public-admin-audit/12-organizer-venue-logistics-mobile.png` at 390×844, responsive venue-and-logistics workflow.
- Public mobile above-fold final: `.context/event-mobile-followup/04-public-mobile-final.png` at 390×844, event title, starting price, date, venue, and purchase action visible on load.
- Public desktop regression: `.context/event-mobile-followup/05-public-desktop-final.png` at 1440×1000, desktop poster composition preserved.
- Events discovery mobile: `.context/event-mobile-followup/03-events-mobile-listing-full.png` at 390px wide, Upcoming Events ordered above Past Events.
- Organizer login final: `.context/event-mobile-followup/06-login-final-prefilled.png` at 1024×1196, dedicated Event Hub entry with real populated input values and no error state.

## Findings

- No actionable P0, P1, or P2 findings remain.
- Typography: Bebas Neue, Inter, and IBM Plex Mono retain the approved display/calm/true hierarchy. Public title scale is intentionally poster-like; operational values and prices remain mono.
- Spacing and layout: public composition is bold and minimal at desktop and mobile. Mobile now prioritizes event commerce: name, starting price, date, venue, and Get Tickets appear before artwork and within 844px. Desktop retains its two-column poster composition. Duplicate public copy, the separate care panel, and excess list hierarchy were removed. Organizer logistics group venue, insurance, layout, capacity, equipment, and upgrades into short scan-friendly sections. Admin remains dense without control overlap at tested breakpoints.
- Colors and tokens: black canvas, flat near-black surfaces, white controls, hairline borders, and microdosed live green match Afterglow Clinical. No blur or decorative gradient was added.
- Image quality and assets: existing Avalon marks and Lucide icons are used; no fake visual assets or placeholder illustrations were introduced. The no-photo state intentionally uses the real Avalon mark.
- Copy and content: public copy now focuses on the event and admission. Clinical configuration and pricing remain in Avalon Event Control; organizer copy stays aggregate-only and explicitly excludes attendee identity and clinical data.
- Operational handoff: venue/company and private-party paths, COI and venue requirements, floor plans, venue photos, layout notes, load-in access, expected attendance versus approved cap, service upgrades, and the Avalon-brings checklist are represented without adding clinical coordination to organizer readiness.
- Event discovery: compact typographic cards avoid ungrounded imagery. Cannabis CE Night appears under Upcoming Events above Maxim Superbowl Party under Past Events, with the exact requested 2026 dates.
- Accessibility: one H1 per screen, labeled tabs and controls, visible focusable buttons, 44px+ primary targets, and readable dark-theme contrast were confirmed from browser snapshots.

## Comparison history

1. Initial capture showed a P0 missing-event state at `/events/after-hours-recovery-club`.
   - Fix: added the shared demo event and a functioning admission-tier route.
   - Evidence: `.context/event-public-admin-audit/01-before-public-desktop.png` → `.context/event-public-admin-audit/09-public-desktop-final.png`.
2. First public implementation had P2 over-explanation and excessive vertical density.
   - Fix: removed the subheadline, admission-only footer note, and public clinical upsell; tightened Included and Good to know; reduced the fine print to two facts.
   - Post-fix evidence: `.context/event-public-admin-audit/08-public-mobile-final.png` and `.context/event-public-admin-audit/09-public-desktop-final.png`.
3. Organizer readiness label did not match the requested terminology.
   - Fix: changed `SALE READINESS` to `EVENT READINESS`; no clinician-coordination item was added.
   - Post-fix evidence: `.context/event-public-admin-audit/10-organizer-event-readiness-final.png`.
4. Event Readiness lacked a complete venue-production handoff.
   - Fix: added venue/company details, conditional COI and insurance requirements, layout and access notes, private document uploads, attendance and service-cap planning, furniture/signage responsibility, service upgrades, and an explicit Avalon equipment checklist including extension cords and power strips.
   - Post-fix evidence: `.context/event-public-admin-audit/13-organizer-complete-event-ops-final.png`, `.context/event-public-admin-audit/12-organizer-venue-logistics-mobile.png`, and `.context/event-public-admin-audit/14-admin-event-ops-final.png`.
5. Mobile public event page had a P1 content-priority failure: the square no-photo Avalon artwork occupied the first viewport while date, venue, price, and ticket action appeared below it.
   - Fix: reordered the mobile layout so facts and commerce precede artwork, changed the mobile artwork ratio to 16:10, surfaced `From $65`, and added a working `Get Tickets — $65` quick action above the full tier chooser.
   - Post-fix evidence: `.context/event-mobile-followup/01-public-mobile-before.png` → `.context/event-mobile-followup/04-public-mobile-final.png`; desktop regression evidence is `.context/event-mobile-followup/05-public-desktop-final.png`.
6. Organizer login had a P0 entry-path failure: `/organizer` redirected to generic customer login and the organizer ID looked populated while remaining only placeholder text.
   - Fix: preserved `portal=organizer` and the organizer redirect in the route guard, seeded actual local demo values when switching portals, and submitted browser-visible DOM values as an autofill-safe fallback.
   - Post-fix evidence: `.context/attachments/lHNWsw/Screenshot 2026-07-20 at 6.30.26 PM.png` → `.context/event-mobile-followup/06-login-final-prefilled.png`; both direct and in-page Event Hub entry paths reached `/organizer`.

## Focused comparison evidence

- User-provided text-region crops were compared with the updated full-page renders in the same visual review input. No additional crop was required because each requested region is legible in the final desktop/mobile captures.
- The organizer source screen and admin Event Control screen were compared together. Header geometry, pills, typography, borders, green state accent, and portal density remain consistent while the admin information architecture is intentionally more operational.
- The 390×844 public before/final screens, the full mobile event-discovery screen, and the user-provided login failure were opened together in one comparison input. The critical text and controls were legible at full-view scale, so no additional focused crop was needed.

## Primary interactions tested

- Public: selected Early Entry and All Night Access; verified pressed state, total update from $65 to $95, and tier-specific presale URL.
- Public mobile: activated `Get Tickets — $65` and verified navigation to `/presale/after-hours-recovery-club?tier=demo-ticket-1`.
- Event discovery: verified Upcoming Events renders before Past Events and the requested event names/dates are visible at 390px.
- Admin: opened Ticket pricing and Clinical setup tabs; verified form controls and the Avalon-only boundary; opened Create event and verified the complete draft form.
- Organizer: verified unauthenticated `/organizer` redirects to the dedicated Event Hub login with actual `ORGANIZER001` and demo password input values; submitted successfully to `/organizer`. Repeated from generic `/login` via Event Organizer Hub and reached `/organizer`. Also selected Task lighting; saved the venue-and-logistics plan; confirmed the success state, upload controls, Event Readiness, and public-page entry point.
- Browser console: zero errors on final public, admin, and organizer checks.

## Verification

- `npm run lint`
- `npm run verify:event-organizer` — 18 checks passed.
- `npm run verify:events-core` — 18 checks passed.
- `npm run verify:events-checkout` — 14 checks passed.
- `npm run build`

final result: passed
