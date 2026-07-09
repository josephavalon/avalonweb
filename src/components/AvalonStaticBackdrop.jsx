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
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.13)',
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
