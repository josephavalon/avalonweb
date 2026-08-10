import React from 'react';
import { useReducedMotion } from '@/components/ui/PageTransitionMotion';

// The source press marks include both light and dark screenshot backgrounds.
// `scripts/normalize-press-logos.mjs` converts them to transparent espresso
// artwork so the rail stays crisp on either light or dark surfaces.
// `h` is a per-mark cap height in px, not a uniform one. These logos run from
// 1:1 (MobileCoin) to 9.45:1 (Faena), so a shared height makes width follow the
// aspect ratio: at 26px Faena rendered 246px wide while Dante's Inferno was
// 36px and unreadable. Heights are area-normalised instead — h = sqrt(A / ratio)
// against a constant target area — so every mark carries roughly the same
// visual mass and the widths land in a 32-132px band instead of 26-246px.
const AS_SEEN_AT = [
  { name: 'Faena Miami Beach', src: '/logos/press-dark/faena.png', h: 14 },
  { name: 'Maxim Magazine', src: '/logos/press-dark/maxim.png', h: 28 },
  { name: 'The Midway', src: '/logos/press-dark/the-midway.png', h: 22 },
  { name: 'Hereticon', src: '/logos/press-dark/hereticon.png', h: 26 },
  { name: 'The Loom', src: '/logos/press-dark/the-loom.png', h: 22 },
  { name: '111 Minna Gallery', src: '/logos/press-dark/111-minna.png', h: 30 },
  { name: "Dante's Inferno", src: '/logos/press-dark/dantes-inferno-gpt.png', h: 38 },
  { name: 'FIRE', src: '/logos/press-dark/fire-gpt.png', h: 24 },
  { name: 'Discourse', src: '/logos/press-dark/discourse.png', h: 21 },
  { name: 'Sanai', src: '/logos/press-dark/sanai-gpt.png', h: 20 },
  { name: 'MobileCoin', src: '/logos/press-dark/mobilecoin-gpt.png', h: 42 },
];
const MOBILE_AS_SEEN_AT = [
  { name: 'Maxim Magazine', src: '/logos/press-dark/maxim.png' },
  { name: 'The Midway', src: '/logos/press-dark/the-midway.png' },
  { name: 'Hereticon', src: '/logos/press-dark/hereticon.png' },
  { name: 'The Loom', src: '/logos/press-dark/the-loom.png' },
];
const HOMEPAGE_COMPACT = AS_SEEN_AT.slice(0, 6);
// Same iOS-safe scaffold as InstagramFeed's marquee: layer-promoted wrappers,
// inline CSS keyframes on both strips, desktop hover pause, and reduced motion
// honored on both surfaces. Standard press-band proportions — small, uniform,
// trust-building.
export default function AsSeenAt({ tone = 'dark', compact = false }) {
  const reduce = useReducedMotion();
  // No hover pause. The band is decorative and should read as one continuous,
  // unhurried movement; stopping under the cursor made it feel interactive when
  // there is nothing to interact with. Reduced motion is still honoured.
  const isRunning = !reduce;
  const isLight = tone === 'light';

  const cell = (item, i) => {
    const imageStyle = {
      filter: isLight ? 'none' : 'brightness(0) invert(1)',
      WebkitFilter: isLight ? 'none' : 'brightness(0) invert(1)',
      mixBlendMode: 'normal',
      ...(item.h ? { height: `${item.h}px`, width: 'auto' } : {}),
      ...(item.offsetY ? { transform: `translateY(${item.offsetY})` } : {}),
    };

    return (
      // Cap-height normalisation, not box-fitting. A fixed 152/184px cell makes
      // the widest marks width-bound and collapses them: Faena is 9.4:1 and
      // rendered 8px tall against everyone else's 26px. Share a height, let
      // width follow the artwork, and space the cells with padding.
      <div
        key={`${item.name}-${i}`}
        className="flex h-[40px] shrink-0 items-center justify-center px-5 md:h-[46px] md:px-7"
      >
        <img
          src={item.src}
          alt={item.name}
          loading="eager"
          decoding="async"
          draggable={false}
          style={imageStyle}
          className="select-none w-auto max-w-none object-contain opacity-70"
        />
      </div>
    );
  };

  return (
    <div
      className="av-asa relative z-10 w-full pb-6 pt-4 md:pb-5 md:pt-4"
      role="region"
      aria-label="Trusted by"
      data-tone={tone}
    >
      {/* Eyebrow — left-aligned to the hero's content edge (px-5 md:px-12). */}
      <div className="px-5 md:px-12">
        <p className="font-body text-[10px] font-semibold uppercase tracking-[0.32em] text-foreground md:text-[11px]">
          Trusted by
        </p>
      </div>

      {compact ? (
        /* Cap-height normalisation, not box-fitting. These marks range from
           2.2:1 (111 Minna) to 9.4:1 (Faena). Fitting them all into one fixed
           152/184px cell makes the widest one width-bound and collapse — Faena
           rendered 8px tall against everyone else's 26-29px. Sharing a height
           and letting width follow the artwork is how a press band stays
           optically even. max-w keeps the widest mark from eating the row. */
        <div className="av-asa-compact hidden min-w-0 items-center justify-between gap-6 px-5 md:flex md:px-12">
          {HOMEPAGE_COMPACT.map((item, i) => (
            <img
              key={`${item.name}-${i}`}
              src={item.src}
              alt={item.name}
              loading="eager"
              decoding="async"
              draggable={false}
              style={{
                filter: isLight ? 'none' : 'brightness(0) invert(1)',
                WebkitFilter: isLight ? 'none' : 'brightness(0) invert(1)',
                ...(item.scale ? { transform: `scale(${item.scale})` } : {}),
              }}
              className="h-[22px] w-auto max-w-[20%] shrink select-none object-contain opacity-70 transition-opacity duration-base ease-editorial hover:opacity-100 md:h-[26px]"
            />
          ))}
        </div>
      ) : (
        /* Desktop marquee — CSS keyframe on a doubled strip. */
        <div
          className="av-asa-marquee-viewport relative mt-3 hidden overflow-hidden md:block"
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
        </div>
      )}

      {/* Mobile marquee — transform the strip instead of mutating scrollLeft.
          iOS can leave blend-mode paint trails when a native scroller is moved
          every animation frame, which makes adjacent logos appear to overlap. */}
      <div className="av-asa-mobile-viewport relative mt-4 md:hidden">
        <div
          className="av-asa-mobile-moving-track"
          style={{
            animation: 'av-asa-marquee 24s linear infinite',
            WebkitAnimation: 'av-asa-marquee 24s linear infinite',
            animationPlayState: isRunning ? 'running' : 'paused',
            WebkitAnimationPlayState: isRunning ? 'running' : 'paused',
          }}
        >
          {[0, 1].map((group) => (
            <div
              key={group}
              className="av-asa-mobile-static-grid"
              aria-hidden={group === 1 ? 'true' : undefined}
            >
              {MOBILE_AS_SEEN_AT.map((item) => (
                <div key={item.name} className="av-asa-mobile-static-cell">
                  <img
                    src={item.src}
                    alt={group === 0 ? item.name : ''}
                    loading="eager"
                    decoding="async"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .av-asa-marquee-viewport {
          -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 94%, transparent 100%);
          mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 94%, transparent 100%);
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
