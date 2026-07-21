**Correction target**

- User-reported oversized desktop state: `/Users/josephmbp/conductor/workspaces/avalonweb/vilnius/.context/attachments/6lTGVX/Screenshot 2026-07-21 at 10.42.43 AM.png`
- Explicit requirements: restore the pre-redesign standard sizing and keep the next card completely below the desktop fold.
- Existing product scale used as the source of truth: the prior homepage `text-display-xl` token (`clamp(3.5rem, 9vw, 8rem)`), the 64px desktop navigation, 14px proof copy, and 448px action rail.

**Implementation evidence**

- Corrected desktop screenshot: `.context/homepage-qa/prior-scale-1996x1168.png`
- Before/after comparison: `.context/homepage-qa/prior-scale-comparison.png`
- Primary desktop viewport: 1996 × 1168 CSS pixels, matching the visible page area in the supplied Safari capture after browser chrome is removed.
- Additional viewports: 1985 × 1324 desktop and 390 × 844 mobile.
- State: homepage with care-host behavior, Book linked to Acuity, dark canvas, and below-fold content loaded.

**Findings**

- No actionable P0, P1, or P2 issues remain.
- Desktop typography now uses the established prior scale rather than the screenshot-redesign scale. At 1996 × 1168, the headline renders at 409 × 225px with a maximum 128px font size.
- Desktop navigation is restored to the standard 64px height with the smaller brand lockup, 18px links, and 48px contact controls.
- The proof rail uses the prior 14px copy and 16px icons. The primary action rail is 448px wide and the Book control is 72px high.
- The hero is exactly one dynamic viewport high. At 1996 × 1168, the first card begins at y=1232; at 1985 × 1324, it begins at y=1388. It is not visible in either desktop first frame.
- Mobile retains its established 390 × 844 composition. The first card begins at y=884, Book remains above the fold, and document width equals viewport width.
- The supplied Avalon mark is reused for the reduced desktop watermark; all visible UI icons continue to come from the project icon library.

**Primary behavior checked**

- Book resolves to `https://app.acuityscheduling.com/schedule/a9d85b1e`.
- Menu and Events remain in the desktop navigation and hero action rail.
- `PLANS` remains absent from the care-host hero.
- Desktop and mobile document widths match their viewports with no horizontal overflow.
- Browser console reports zero errors and zero warnings.

**Iteration history**

- Previous pass reduced the composition but allowed the next card to enter the desktop viewport and retained larger redesign typography.
- Current pass restored the prior typography and control scale, reduced the navigation and watermark, reinstated full-viewport hero height, and restored the section's normal below-fold spacing.
- The combined before/after image confirms the scale reduction; browser geometry confirms that the next card is fully below the fold.

**Implementation checklist**

- [x] User-supplied desktop symptom capture opened
- [x] Before/after comparison opened as one image
- [x] 1996 × 1168 desktop verification
- [x] 1985 × 1324 tall-desktop verification
- [x] 390 × 844 mobile regression verification
- [x] CTA destination and horizontal-overflow checks
- [x] Console/runtime error check

final result: passed
