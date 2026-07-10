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
        // Nav bar height (~4.5rem) offset so the drop tip starts BELOW the pinned
        // top menu instead of peeking behind it. Safe-area offset added for iOS
        // notch. Bottom padding stays safe-area only.
        top: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)',
        bottom: 'env(safe-area-inset-bottom, 0px)',
        // Fill color uses a CSS var so themes can retint the watermark:
        // - dark (default): 11% white → soft gray chevron
        // - warriors: light yellow (overridden in src/index.css)
        backgroundColor: 'var(--av-backdrop-fill, rgba(255, 255, 255, 0.11))',
        WebkitMaskImage: 'url(/avalon-logo.svg)',
        maskImage: 'url(/avalon-logo.svg)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}
