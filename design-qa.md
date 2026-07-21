**Correction target**

- Source visual truth: `/Users/josephmbp/conductor/workspaces/avalonweb/vilnius/.context/attachments/3Vg2HE/Screenshot 2026-07-21 at 11.23.41 AM.png`.
- Supporting before-state capture: `.context/homepage-chevron-before-1996x1168.png`.
- Explicit requirements: keep only the Avalon logo mark in the homepage header, remove the homepage's right-facing chevrons, and render only one static background logo.

**Implementation evidence**

- Desktop implementation screenshot: `.context/homepage-chevron-after-desktop.png`.
- Mobile implementation screenshot: `.context/homepage-chevron-after-mobile.png`.
- Combined before/after comparison: `.context/homepage-chevron-wordmark-comparison.png`.
- Viewports: 1996 × 1168 desktop and 390 × 844 mobile.
- State: care-host homepage with below-fold content loaded and the Book destination set to Acuity.

**Findings**

- No actionable P0, P1, or P2 differences remain.
- The homepage header now shows the supplied Avalon mark without the visible `AVALON VITALITY` desktop wordmark or mobile `AVALON` wordmark. The accessible home label remains available to screen readers.
- The hero's Book, View Menu, and Private Events controls no longer contain right-facing arrow/chevron icons.
- The homepage contains one `.home-hero__watermark`, no site-wide `.av-static-backdrop`, and the watermark has no CSS animation.
- Fonts and typography: existing hero, navigation, and CTA type styles are unchanged; only the requested header wordmark is removed.
- Spacing and layout rhythm: navigation height, link placement, hero scale, CTA dimensions, and below-fold spacing are preserved. The next card remains below the fold at both tested viewports.
- Colors and visual tokens: the black canvas, white controls, muted watermark, borders, and brand colors are unchanged.
- Image quality and asset fidelity: the existing source logo asset remains in both the header and the single hero watermark; no replacement artwork or CSS approximation was introduced.
- Copy and content: the hero eyebrow and all CTA labels remain unchanged. Only the requested header lockup text is removed.

**Primary behavior checked**

- Desktop and mobile render meaningful homepage content with no error overlay.
- Book resolves to `https://app.acuityscheduling.com/schedule/a9d85b1e`; Menu resolves to `/protocols`; Events remains present in navigation.
- Header logo remains a working home link.
- Desktop and mobile document widths match their viewports with no horizontal overflow.
- Browser console reports zero errors and zero warnings.

**Comparison history**

- Initial evidence showed the two-line `AVALON VITALITY` header lockup and right-arrow icons in all three hero actions.
- The implementation removed those elements without altering the existing layout, typography, color system, or single hero watermark.
- The combined comparison confirms the desktop removal; the dedicated mobile capture confirms the compact header keeps only the logo mark.

**Focused-region evidence**

- The user-supplied source is already a focused header crop, so no additional crop was needed. It was inspected alongside the full desktop before/after comparison at original resolution.

**Implementation checklist**

- [x] User-supplied header crop opened
- [x] Before and after placed in one comparison image and inspected
- [x] 1996 × 1168 desktop verification
- [x] 390 × 844 mobile verification
- [x] Single static watermark and chevron absence checks
- [x] CTA destination, overflow, and console checks

final result: passed
