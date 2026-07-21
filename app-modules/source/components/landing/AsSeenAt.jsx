import React, { useState } from 'react';
import { useReducedMotion } from '@/components/ui/PageTransitionMotion';

const DARK_SOURCE_FILTER = 'grayscale(1) contrast(4) brightness(1.55)';
const LIGHT_SOURCE_FILTER = 'grayscale(1) invert(1) contrast(4)';

// These supplied press marks are screenshots rather than transparent exports.
// Their per-logo filters force each screenshot background to black, then
// screen blending makes that black disappear over the hero.
const AS_SEEN_AT = [
  { name: 'Faena Miami Beach', src: '/logos/faena.png', filter: DARK_SOURCE_FILTER },
  { name: 'Maxim Magazine', src: '/logos/maxim.png', filter: LIGHT_SOURCE_FILTER },
  { name: 'The Midway', src: '/logos/the-midway.png', filter: LIGHT_SOURCE_FILTER },
  { name: 'Hereticon', src: '/logos/hereticon.png', filter: LIGHT_SOURCE_FILTER },
  { name: 'The Loom', src: '/logos/the-loom.png', filter: DARK_SOURCE_FILTER },
  { name: '111 Minna Gallery', src: '/logos/111-minna.png', filter: DARK_SOURCE_FILTER },
  { name: "Dante's Inferno", src: '/logos/dantes-inferno-gpt.png', scale: 1.18 },
  { name: 'FIRE', src: '/logos/fire-gpt.png' },
  { name: 'Discourse', src: '/logos/discourse.png', filter: 'grayscale(1) contrast(4) brightness(2)' },
  { name: 'MobileCoin', src: '/logos/mobilecoin-gpt.png', scale: 1.08 },
];
const MOBILE_GROUP_WIDTH = AS_SEEN_AT.length * 152;

export default function AsSeenAt() {
  const reduce = useReducedMotion();
  const [hoverPaused, setHoverPaused] = useState(false);
  const isRunning = !hoverPaused && !reduce;

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
      className="av-asa relative z-10 w-full pb-6 pt-4 md:pb-5 md:pt-4"
      role="region"
      aria-label="As seen at"
    >
      <div className="px-5 md:px-12">
        <p className="font-body text-[10px] font-semibold uppercase tracking-[0.32em] text-foreground md:text-[11px]">
          As seen at
        </p>
      </div>

      <div
        className="av-asa-marquee-viewport relative mt-3 hidden overflow-hidden md:block"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
      >
        <div className="av-asa-strip-wrap" style={{ transform: 'translateZ(0)', willChange: 'transform' }}>
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
              <div key={group} className="flex" aria-hidden={group === 1 ? 'true' : undefined}>
                {AS_SEEN_AT.map(cell)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="av-asa-mobile-viewport relative mt-4 h-10 overflow-hidden md:hidden">
        <div
          className="av-asa-mobile-strip flex h-10 items-center"
          style={{
            width: `${MOBILE_GROUP_WIDTH * 2}px`,
            maxWidth: 'none',
            animation: 'av-asa-marquee 90s linear infinite',
            WebkitAnimation: 'av-asa-marquee 90s linear infinite',
            animationPlayState: isRunning ? 'running' : 'paused',
            WebkitAnimationPlayState: isRunning ? 'running' : 'paused',
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform',
          }}
        >
          {[0, 1].map((group) => (
            <div
              key={group}
              className="flex shrink-0 select-none"
              style={{ width: `${MOBILE_GROUP_WIDTH}px`, maxWidth: 'none' }}
              aria-hidden={group === 1 ? 'true' : undefined}
            >
              {AS_SEEN_AT.map(cell)}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .av-asa-marquee-viewport {
          -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 94%, transparent 100%);
          mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 94%, transparent 100%);
        }
        .av-asa-mobile-viewport {
          -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%);
          mask-image: linear-gradient(to right, transparent 0%, #000 14%, #000 86%, transparent 100%);
        }
        @keyframes av-asa-marquee {
          0%   { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @-webkit-keyframes av-asa-marquee {
          0%   { -webkit-transform: translate3d(0, 0, 0); }
          100% { -webkit-transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </div>
  );
}
