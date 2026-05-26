import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { EASE, premiumHover } from '@/lib/motion';

// Venue / partner text strip — pure text, never breaks on load.
const CLIENT_LOGOS = [
  { name: '111 Minna' },
  { name: 'Secret Party' },
  { name: 'Hereticon' },
  { name: 'Maxim Magazine' },
  { name: 'SF Pride' },
  { name: 'The Midway' },
  { name: 'Club Discourse' },
  { name: 'The Loom' },
];

// ── Featured (punchy / notable clients) — shown first ──────────────────────
const FEATURED = [
  { name: 'J.G.', tag: 'NAD+ IV',       quote: 'Sharp, calm, ready.' },
  { name: 'A.G.', tag: 'Beauty IV',     quote: 'Glutathione drip, every week.' },
  { name: 'C.D.', tag: 'Group Recovery', quote: 'Two nurses. Six guests. Effortless.' },
];

// ── Long-form client reviews ────────────────────────────────────────────────
const REVIEWS = [];

function StarRow({ count }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="w-3.5 h-3.5 text-accent fill-current" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.966a1 1 0 00.95.69h4.168c.969 0 1.371 1.24.588 1.81l-3.374 2.452a1 1 0 00-.364 1.118l1.287 3.966c.3.921-.755 1.688-1.54 1.118L10 14.347l-3.952 2.87c-.784.57-1.838-.197-1.539-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.059 9.393c-.783-.57-.38-1.81.588-1.81h4.168a1 1 0 00.95-.69L9.049 2.927z" />
        </svg>
      ))}
    </div>
  );
}

// Single unified card — glass, stars, quote, name + tag
function ReviewCard({ review, index }) {
  return (
    <motion.article
      whileHover={premiumHover}
      className="rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/[0.08] p-5 flex flex-col gap-3 w-[280px] shrink-0 h-full shadow-[0_18px_70px_hsl(var(--foreground)/0.035)] transition-colors duration-base ease-editorial hover:border-white/[0.16] hover:bg-white/[0.105]"
    >
      <StarRow count={review.stars || 5} />
      <p className="font-body text-sm text-foreground/75 leading-relaxed line-clamp-5">
        &ldquo;{review.quote}&rdquo;
      </p>
      <div className="flex items-center justify-between flex-wrap gap-2 mt-auto">
        <div>
          <p className="font-body text-xs font-semibold text-foreground">{review.name}</p>
          {review.date && <p className="font-body text-[10px] text-foreground/35 mt-0.5">{review.date}</p>}
        </div>
        <span className="inline-block px-2.5 py-1 rounded-full bg-white/[0.08] font-body text-[9px] tracking-[0.2em] uppercase text-foreground/50">
          {review.tag}
        </span>
      </div>
    </motion.article>
  );
}

const Dot = () => (
  <span aria-hidden="true" className="w-[3px] h-[3px] rounded-full bg-foreground/15 shrink-0 inline-block" />
);

// Text-only marquee row — never breaks due to image load failures
function LogoRow({ ariaHidden = false }) {
  return (
    <ul
      aria-hidden={ariaHidden}
      className="flex items-center gap-6 md:gap-9 shrink-0 list-none m-0 p-0 pr-6 md:pr-9"
    >
      {CLIENT_LOGOS.map((logo, i) => (
        <React.Fragment key={`${ariaHidden ? 'b' : 'a'}-${logo.name}`}>
          {i > 0 && <li aria-hidden="true" className="shrink-0"><Dot /></li>}
          <li className="shrink-0">
            <span className="font-heading text-[11px] md:text-xs tracking-[0.22em] uppercase text-foreground/30 whitespace-nowrap">
              {logo.name}
            </span>
          </li>
        </React.Fragment>
      ))}
      <li aria-hidden="true" className="shrink-0"><Dot /></li>
    </ul>
  );
}

export default function Reviews() {
  const scrollRef = useRef(null);

  return (
    <section aria-label="Client reviews" className="pt-10 pb-10 md:pt-16 md:pb-16 px-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8 md:mb-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.95, ease: EASE }}
        >
          <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">
            Client Trust
          </p>
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">
            Trusted
          </h2>
          <p className="font-body text-sm text-foreground/50 leading-relaxed mt-3 max-w-md">
            Private clients. Groups. Hotels.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-5 max-w-md">
            {[
              ['5.0', 'Client rating'],
              ['90min', 'Arrival window'],
              ['RN', 'Administered'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-foreground/10 bg-white/[0.07] px-3 py-3 backdrop-blur-xl">
                <p className="font-heading text-2xl text-foreground leading-none tracking-[0.04em]">{value}</p>
                <p className="font-body text-[9px] text-foreground/40 tracking-[0.16em] uppercase mt-1">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* "Seen At" logo marquee */}
      <div className="mb-10 -mx-4">
        <div className="max-w-6xl mx-auto mb-4 px-4">
          <p className="font-body text-[9px] tracking-[0.3em] uppercase text-foreground/25">
            Seen At
          </p>
        </div>
        <div className="logo-strip-wrap">
          <div className="logo-strip-track">
            <LogoRow />
            <LogoRow ariaHidden />
          </div>
        </div>
      </div>

      {/* Combined carousel */}
      <div className="reviews-fade-wrap -mx-4">
        <div
          ref={scrollRef}
          className="flex items-stretch gap-4 overflow-x-auto pt-3 pb-3"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory',
            scrollPaddingLeft: '16px',
            overscrollBehaviorX: 'none',
            marginTop: '-12px',
          }}
          role="region"
          aria-label="Reviews carousel — scroll to see more"
        >
          {/* Left edge spacer — keeps first card from sitting flush against the screen */}
          <div className="w-4 shrink-0" aria-hidden="true" />
          {[...FEATURED, ...REVIEWS].map((item, i) => (
            <div key={i} style={{ scrollSnapAlign: 'start' }} className="shrink-0 flex self-stretch">
              <ReviewCard review={item} index={i} />
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="max-w-6xl mx-auto mt-6">
          <p className="font-body text-[10px] text-foreground/30 leading-relaxed max-w-2xl">
          Individual experiences vary. Not medical advice.
        </p>
      </div>

      <style>{`
        /* Fade right edge only — left padding already frames the first card */
        .reviews-fade-wrap {
          -webkit-mask-image: linear-gradient(to right, black 0%, black 92%, transparent 100%);
                  mask-image: linear-gradient(to right, black 0%, black 92%, transparent 100%);
        }
        .reviews-fade-wrap ::-webkit-scrollbar { display: none; }

        /* Logo marquee */
        .logo-strip-wrap {
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to right, transparent 0, black 8%, black 92%, transparent 100%);
                  mask-image: linear-gradient(to right, transparent 0, black 8%, black 92%, transparent 100%);
        }
        .logo-strip-track {
          display: flex;
          align-items: center;
          width: max-content;
          flex-wrap: nowrap;
          gap: 0;
          animation: logo-strip-scroll 24s linear infinite;
          will-change: transform;
          padding: 0.25rem 0;
        }
        @media (min-width: 768px) {
          .logo-strip-track { animation-duration: 32s; }
        }
        @keyframes logo-strip-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (hover: hover) {
          .logo-strip-wrap:hover .logo-strip-track { animation-play-state: paused; }
        }
        @media (prefers-reduced-motion: reduce) {
          .logo-strip-track { animation: none; }
        }
      `}</style>
    </section>
  );
}
