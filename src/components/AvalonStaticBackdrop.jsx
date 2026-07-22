// Site-wide static Avalon drop mark, rendered as a fixed, fit-to-viewport,
// grayed-out watermark behind every page. Consumed by MobileShell so it
// mounts on every route.
//
// z-index: `z-0` (not `-z-10`) — the HTML root paints an opaque
// bg-background in dark mode (index.css:336), so a negative z-index
// puts this element UNDER the root paint and it never renders. `z-0`
// sits on top of the root bg and below anything with positive z.
//
// Color set as inline rgba (NOT text-foreground/[0.14]) because
// Tailwind's alpha modifier compiled the mark near-full-opacity in the
// earlier per-card variant, so we lock color explicitly here.
export default function AvalonStaticBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="av-static-backdrop pointer-events-none fixed left-0 right-0 z-0"
      style={{
        // Nav bar height (~4.5rem) + iOS notch offset so the drop tip starts
        // BELOW the pinned top menu instead of peeking behind it.
        top: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)',
        // Explicit height using 100lvh (Large Viewport Height — the FULL
        // viewport with browser chrome retracted). CRITICAL: this must NOT
        // derive from `bottom` + viewport. On iOS Safari the URL bar
        // collapses during the initial scroll gesture; that fluctuates the
        // viewport height, which resized the box, which re-fit the
        // `mask-size: contain` chevron — making the drop visibly shift.
        // 100lvh is stationary through URL-bar transitions. `100vh` is
        // fallback for browsers without lvh support (iOS <16, older Chromium):
        // on those, 100vh already behaves like the large viewport.
        height: 'calc(100vh - 4.5rem - env(safe-area-inset-top, 0px))',
        maxHeight: 'calc(100lvh - 4.5rem - env(safe-area-inset-top, 0px))',
        // Fill color uses a CSS var so themes can retint the watermark:
        // - dark (default): 11% white → soft gray chevron
        // - warriors: light yellow (overridden in src/index.css)
        backgroundColor: 'var(--av-backdrop-fill, rgba(255, 255, 255, 0.11))',
        WebkitMaskImage: 'url(/avalon-logo.svg)',
        maskImage: 'url(/avalon-logo.svg)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: '72.5% 50%',
        maskPosition: '72.5% 50%',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}
