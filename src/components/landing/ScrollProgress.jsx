import React, { useEffect, useState } from 'react';

// Thin 2px bar at the top of the page that tracks scroll depth.
// Mounted at the document root level (above Navbar) so it sits as a global progress indicator.
//
// Colour is NOT set here. `bg-accent` resolves to white under the `.dark` theme,
// which is invisible on the cream consumer surfaces (body #f6f2eb). The ink
// override for those surfaces lives in index.css, keyed off .nd-corner-header.
// Transitions also live in CSS so prefers-reduced-motion can flatten them.
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, pct)));
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="av-scroll-progress fixed top-0 left-0 right-0 h-[2px] z-[60] pointer-events-none"
      style={{ opacity: progress > 1 ? 1 : 0 }}
    >
      <div
        className="av-scroll-progress__bar h-full bg-accent origin-left"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
}
