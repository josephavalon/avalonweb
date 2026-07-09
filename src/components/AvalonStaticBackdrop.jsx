// Site-wide static Avalon drop mark, rendered as a fixed, fit-to-viewport,
// grayed-out watermark behind every page. Consumed by MobileShell so it
// mounts on every route.
//
// Color set as inline rgba (NOT text-foreground/[0.05]) because Tailwind's
// alpha modifier compiled the mark near-full-opacity in v1, so we lock the
// color explicitly here.
export default function AvalonStaticBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
