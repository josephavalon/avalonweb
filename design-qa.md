**Source visual truth**

- Original: `/Users/josephmbp/conductor/workspaces/avalonweb/vilnius/.context/attachments/s9Nr4k/Screenshot 2026-07-21 at 9.40.36 AM.png`
- Normalized page canvas: `.context/homepage-qa/source-normalized.png`
- The source viewer's outer rounded frame and bottom-right viewer control are presentation chrome, not homepage UI, and are excluded from implementation requirements.

**Implementation evidence**

- Desktop screenshot: `.context/homepage-qa/desktop-final.png`
- Mobile screenshot: `.context/homepage-qa/mobile-final.png`
- Desktop viewport: 1985 × 1324 CSS pixels, DPR 1
- Mobile viewport: 390 × 844 CSS pixels, DPR 1
- State: homepage with `care=1`, dark canvas, care navigation, Acuity booking destination

**Full-view comparison evidence**

- Combined source/implementation image: `.context/homepage-qa/desktop-comparison-final.png`
- Composition, hierarchy, copy, hero proportions, CTA geometry, navigation, and watermark placement were compared at the same viewport and state.

**Focused region comparison evidence**

- Navigation: `.context/homepage-qa/nav-comparison-final.png`
- Hero typography, proof rail, and CTAs: `.context/homepage-qa/hero-copy-comparison-final.png`
- Focused comparisons were required because the navigation type, proof icons, underline lengths, and display-font rhythm are too small to judge reliably in the full-view comparison alone.

**Findings**

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: existing Bebas Neue and Inter assets match the reference's condensed display face and tracked utility copy. Final desktop line positions are within 0–5 pixels of the normalized reference across the eyebrow, both headline lines, proof rows, button, and supporting links.
- Spacing and layout rhythm: desktop left edge, vertical cadence, CTA dimensions, navigation columns, and oversized watermark match the reference. Mobile preserves the hierarchy, keeps the full conversion block above the fold, and has no horizontal overflow.
- Colors and visual tokens: the page uses the reference's near-black canvas, off-white type/button, subtle gray rules, and low-contrast charcoal watermark without gradients or invented decoration.
- Image quality and asset fidelity: the supplied `/avalon-logo.svg` is reused for both the logo and watermark. Visible UI icons come from the project's icon library; the circular dollar icon was selected to match the reference rather than approximated with custom artwork.
- Copy and content: `AVALON VITALITY`, `MOBILE RECOVERY`, all four proof points, `BOOK NOW`, `VIEW MENU`, and `PRIVATE EVENTS` match the reference. Care navigation contains exactly `BOOK`, `MENU`, and `EVENTS`; `PLANS` is absent.
- Accessibility and behavior: semantic headings, lists, links, labels, visible focus states, 44-pixel-plus tap targets, Escape-to-close, and focus restoration are present.

**Primary interactions tested**

- Desktop and mobile Book links resolve to `https://app.acuityscheduling.com/schedule/a9d85b1e`; the destination returned HTTP 200.
- Menu loads `/protocols` and renders the IV catalog.
- Events loads `/events` and renders the event builder and event lists.
- Mobile menu opens, exposes Book/Menu/Events, closes with Escape, and restores focus to the menu trigger.
- Phone and text links expose the correct `tel:` and `sms:` destinations.

**Console and runtime checks**

- Browser console: 0 errors, 0 warnings on the final homepage capture.
- Desktop document width: 1985px viewport / 1985px scroll width.
- Mobile document width: 390px viewport / 390px scroll width.

**Comparison history**

- Initial gate: blocked because the embedded browser was unavailable and direct Playwright use required user approval.
- Pass 1 findings: headline and proof typography were too compact; the watermark was too far right; desktop navigation content started too far right; the fee icon did not match the circular source icon.
- Pass 1 fixes: increased headline optical scale while preserving line-box height, expanded proof scale and spacing, shifted/resized the watermark, aligned the navigation grid, and changed to the matching circular dollar icon.
- Pass 2 findings: headline leading, proof-row cadence, and lower CTA rhythm remained 12–40 pixels tighter than the source.
- Pass 2 fixes: matched headline leading, redistributed margin between the headline and proof rail, expanded proof row spacing, and compensated the action spacing to preserve CTA position.
- Final visual evidence: desktop full-view and focused comparisons show no actionable P0/P1/P2 drift; responsive mobile evidence shows no overflow, clipping, overlap, or off-screen primary action.

**Implementation Checklist**

- [x] Desktop source/implementation comparison
- [x] Focused navigation and hero comparison
- [x] 390 × 844 mobile verification
- [x] Primary navigation and CTA interactions
- [x] Console/runtime error check
- [x] Acuity availability check

**Follow-up Polish**

- P3: source raster antialiasing is slightly softer than the live browser's locally rendered vector type and logo; this is expected and not actionable.

final result: passed
