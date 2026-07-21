import { useEffect, useState } from 'react';

// Hide-on-scroll-down / show-on-scroll-up pattern (iOS Safari nav).
// Returns true while the nav should be hidden. Always returns false when
// `enabled` is false (desktop, menu open, focus mode, etc.) so the consumer
// can disable cleanly without unmounting.
//
// Threshold: don't hide near the top (HIDE_AFTER) so first-paint feels stable;
// only trigger on a meaningful scroll delta (DELTA) so a single tap with
// inertial bounce doesn't flicker the bar.
const HIDE_AFTER = 96;
const DELTA = 8;

export default function useNavHiddenOnScrollDown({ enabled = true } = {}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return undefined;
    }
    if (typeof window === 'undefined') return undefined;

    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (y <= HIDE_AFTER) {
          setHidden(false);
        } else if (dy > DELTA) {
          setHidden(true);
        } else if (dy < -DELTA) {
          setHidden(false);
        }
        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enabled]);

  return hidden;
}
