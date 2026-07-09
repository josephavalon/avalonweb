import { useRef } from 'react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { EASE, premiumHover } from '@/lib/motion';

// ── Featured (punchy / notable clients) — shown first ──────────────────────
const FEATURED = [
  { name: 'J.G.', tag: 'NAD+ IV',       quote: 'Sharp, calm, ready.' },
  { name: 'A.G.', tag: 'Beauty IV',     quote: 'Glutathione IV, every week.' },
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
      className="av-treatment-card relative flex h-full w-[280px] shrink-0 flex-col gap-3 overflow-hidden rounded-[1.55rem] border p-5 transition-colors duration-base ease-editorial"
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
        <span className="inline-block rounded-full border border-foreground/10 bg-background/34 px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.2em] text-foreground/50 backdrop-blur-xl">
          {review.tag}
        </span>
      </div>
    </motion.article>
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
          <h2 className="font-heading text-display text-foreground uppercase tracking-tight leading-[0.92]">
            Trusted
          </h2>
          <p className="font-body text-sm text-foreground/50 leading-relaxed mt-3 max-w-md">
            Private clients. Groups. Hotels.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-5 max-w-md">
            {[
              ['5.0', 'Client rating'],
              ['90min', 'Arrival window'],
              ['Registered Nurse', 'Administered'],
            ].map(([value, label]) => (
              <div key={label} className="av-treatment-card overflow-hidden rounded-xl border px-3 py-3">
                <p className="font-heading text-2xl text-foreground leading-none tracking-[0.04em]">{value}</p>
                <p className="font-body text-[9px] text-foreground/40 tracking-[0.16em] uppercase mt-1">{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
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
      `}</style>
    </section>
  );
}
