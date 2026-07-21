import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/components/ui/PageTransitionMotion';

const DARK_SOURCE_FILTER = 'grayscale(1) contrast(4) brightness(1.55)';
const LIGHT_SOURCE_FILTER = 'grayscale(1) invert(1) contrast(4)';

// The supplied press marks are screenshots rather than transparent exports.
// Their per-logo filters force each screenshot background to black, then
// `mix-blend-mode: screen` makes that black disappear over the hero while the
// mark remains white. This keeps the exact supplied artwork and avoids the
// solid-white rectangles produced by brightness(0) invert(1).
const AS_SEEN_AT = [
  { name: 'Faena Miami Beach', src: '/logos/faena.png', filter: DARK_SOURCE_FILTER },
  { name: 'Maxim Magazine', src: '/logos/maxim.png', filter: LIGHT_SOURCE_FILTER },
  { name: 'The Midway', src: '/logos/the-midway.png', filter: LIGHT_SOURCE_FILTER },
  { name: 'Hereticon', src: '/logos/hereticon.png', filter: LIGHT_SOURCE_FILTER },
  { name: 'The Loom', src: '/logos/the-loom.png', filter: DARK_SOURCE_FILTER },
  { name: '111 Minna Gallery', src: '/logos/111-minna.png', filter: DARK_SOURCE_FILTER },
  {
    name: "Dante's Inferno",
    src: '/logos/dantes-inferno-gpt.png',
    scale: 1.18,
  },
  { name: 'FIRE', src: '/logos/fire-gpt.png' },
  { name: 'Discourse', src: '/logos/discourse.png', filter: 'grayscale(1) contrast(4) brightness(2)' },
  { name: 'Sanai', src: '/logos/sanai-gpt.png' },
];

// Same iOS-safe scaffold as InstagramFeed's marquee: layer-promoted wrapper,
// inline CSS keyframes on the strip, pointer-drag pause on mobile, hover pause
// on desktop, useReducedMotion honored on both surfaces. Standard press-band
// proportions — small, uniform, trust-building.
export default function AsSeenAt() {
  const reduce = useReducedMotion();
  const [hoverPaused, setHoverPaused] = useState(false);
  const [dragPaused, setDragPaused] = useState(false);
  const isRunning = !hoverPaused && !dragPaused && !reduce;

  // Mobile auto-drift — RAF+sub-pixel accumulator so mobile engines that round
  // scrollLeft to whole pixels still get a smooth idle drift.
  const mobileRef = useRef(null);
  const resumeTimerRef = useRef(0);
  useEffect(() => {
    if (reduce) return;
    const el = mobileRef.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    let virtual = el.scrollLeft;
    const SPEED = 18; // px/s — passive drift; not "reading pace"
    const tick = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!dragPaused) {
        virtual += (SPEED * dt) / 1000;
        const half = el.scrollWidth / 2;
        if (half > 0 && virtual >= half) virtual -= half;
        el.scrollLeft = Math.round(virtual);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, dragPaused]);

  useEffect(() => () => window.clearTimeout(resumeTimerRef.current), []);

  const pauseForDrag = () => {
    window.clearTimeout(resumeTimerRef.current);
    setDragPaused(true);
  };
  const resumeAfterDrag = () => {
    // Native momentum needs a beat to settle before RAF steals scrollLeft back.
    window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => setDragPaused(false), 1000);
  };

  const cell = (item, i) => {
    const imageStyle = {
      filter: item.filter,
      WebkitFilter: item.filter,
      mixBlendMode: 'screen',
      ...(item.scale || item.offsetY
        ? { transform: `translateY(${item.offsetY || '0'}) scale(${item.scale || 1})` }
        : {}),
    };

    return (
      <div
        key={`${item.name}-${i}`}
        className="flex h-[32px] w-[152px] shrink-0 items-center justify-center px-3 md:h-[38px] md:w-[184px] md:px-4"
      >
        <img
          src={item.src}
          alt={item.name}
          loading="eager"
          decoding="async"
          draggable={false}
          style={imageStyle}
          className="select-none max-h-full max-w-full w-auto h-auto object-contain opacity-70 transition-opacity duration-base ease-editorial hover:opacity-100"
        />
      </div>
    );
  };

  return (
    <div
      className="relative z-10 w-full border-t border-white/[0.08] pb-6 pt-4 md:pb-5 md:pt-4"
      role="region"
      aria-label="As seen at"
    >
      {/* Eyebrow — left-aligned to the hero's content edge (px-5 md:px-12). */}
      <div className="px-5 md:px-12">
        <p className="font-body text-[10px] uppercase tracking-[0.32em] text-foreground/50 md:text-[11px]">
          As seen at
        </p>
      </div>

      {/* Desktop marquee — CSS keyframe on a doubled strip. */}
      <div
        className="relative mt-3 hidden overflow-hidden md:block"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
      >
        <div
          className="av-asa-strip-wrap"
          style={{ transform: 'translateZ(0)', willChange: 'transform' }}
        >
          <div
            className="av-asa-strip flex w-max"
            style={{
              animation: 'av-asa-marquee 90s linear infinite',
              WebkitAnimation: 'av-asa-marquee 90s linear infinite',
              animationPlayState: isRunning ? 'running' : 'paused',
              WebkitAnimationPlayState: isRunning ? 'running' : 'paused',
            }}
          >
            {[0, 1].map((group) => (
              <div
                key={group}
                className="flex"
                aria-hidden={group === 1 ? 'true' : undefined}
              >
                {AS_SEEN_AT.map(cell)}
              </div>
            ))}
          </div>
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black to-transparent md:w-20" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black to-transparent md:w-20" />
      </div>

      {/* Mobile scroller — native overflow-x-auto, RAF auto-drift. */}
      <div
        ref={mobileRef}
        className="av-asa-mobile-scroller mt-4 flex overflow-x-auto md:hidden"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        onPointerDown={pauseForDrag}
        onPointerUp={resumeAfterDrag}
        onPointerCancel={resumeAfterDrag}
      >
        <div className="flex w-max select-none">
          {[0, 1].map((group) => (
            <div
              key={group}
              className="flex"
              aria-hidden={group === 1 ? 'true' : undefined}
            >
              {AS_SEEN_AT.map(cell)}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes av-asa-marquee {
          0%   { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @-webkit-keyframes av-asa-marquee {
          0%   { -webkit-transform: translate3d(0, 0, 0); }
          100% { -webkit-transform: translate3d(-50%, 0, 0); }
        }
        .av-asa-mobile-scroller::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
