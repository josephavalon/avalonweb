import React, { useRef } from 'react';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

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
  { name: 'J.G.',       tag: 'NAD+ IV',         quote: "I'm a founder who codes 20hrs a day now. NAD+ makes it happen." },
  { name: 'R.D.',       tag: 'NAD+ 1000mg',      quote: "I love NAD+. I knock one out before any big pitch. It's part of my routine now." },
  { name: 'J.L.',       tag: 'Performance IV',   quote: "I'm an AI founder. Every day I gain new abilities. Avalon holds me down through the storm." },
  { name: 'A.G.',       tag: 'Beauty IV',        quote: 'Beauty IV is my weekly. Glutathione drip, every time.' },
  { name: 'G.B.',       tag: 'Event Recovery',   quote: 'Booked Avalon for a festival. Green room was lit. They set up an entire recovery lounge backstage. Artists and crew loved it.' },
  { name: 'C.A.',       tag: 'CBD IV',           quote: "Who knew CBD IVs were a thing? Zero THC. The most relaxing drip experience I've had. Already booked my next bag." },
];

// ── Long-form client reviews ────────────────────────────────────────────────
const REVIEWS = [
  {
    name: 'Sarah M.',  tag: 'Post-Marathon',    date: 'March 2025',    stars: 5,
    quote: 'I finished my first marathon and could barely move. Within the hour the RN arrived, set everything up in my living room, and I was genuinely calm for the first time all day. Felt restored by evening — completely unexpected how peaceful the whole experience was.',
  },
  {
    name: 'James K.',  tag: 'Business Travel',  date: 'February 2025', stars: 5,
    quote: "Red-eye from NYC, pitch at 9am the next morning. I booked Avalon the night I landed and the RN came straight to my hotel. I can't fully explain it but I felt noticeably sharper in that meeting. Definitely doing this every trip.",
  },
  {
    name: 'Priya S.',  tag: 'Next-Morning',     date: 'January 2025',  stars: 5,
    quote: "Bachelorette party. I'll leave it at that. The next morning was rough for all eight of us. Called Avalon at 9am, RN arrived in 75 minutes, and we were back to normal by noon. We ordered brunch. It was a miracle.",
  },
  {
    name: 'David L.',  tag: 'Weekly Wellness',  date: 'April 2025',    stars: 5,
    quote: "I've made this a weekly ritual and I genuinely think it's a competitive advantage. The consistency is what makes it worth it — not any single session, but the cumulative effect of just staying ahead of it. My schedule is brutal and this helps.",
  },
  {
    name: 'Maya R.',   tag: 'Pre-Event',        date: 'March 2025',    stars: 5,
    quote: 'Had a gala I really wanted to show up for at my best. The RN was discreet, professional, and somehow made the whole thing feel like self-care rather than a medical procedure. I felt genuinely looked after, not just serviced.',
  },
  {
    name: 'Tom B.',    tag: 'Athletic Recovery', date: 'February 2025', stars: 5,
    quote: "I compete in CrossFit regionals and used to drive to IV bars after events. Having it come to the gym after a competition is a completely different level of convenience. I can actually rest while I recover instead of sitting in a waiting room.",
  },
  {
    name: 'Anika W.',  tag: 'Immune Support',   date: 'January 2025',  stars: 5,
    quote: "I'd been dragging for about a week — exhausted, run down, the works. Booked a session just to support my body a bit. Two days after I noticed a real shift in how I was feeling. Hard to say exactly what changed, but something definitely did.",
  },
  {
    name: 'Chris D.',  tag: 'Team Booking',     date: 'April 2025',    stars: 5,
    quote: "Booked for a six-person team offsite. Avalon sent two nurses and the whole thing ran in under two hours. Everyone was impressed it was even logistically possible. Already planning to do it again at our next quarterly.",
  },
];

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
function ReviewCard({ review }) {
  return (
    <article className="rounded-2xl bg-white/[0.08] backdrop-blur-xl border border-white/[0.08] p-5 flex flex-col gap-3 w-[280px] shrink-0 h-full">
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
    </article>
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
    <section aria-label="Client reviews" className="pt-10 pb-6 md:pt-12 md:pb-8 px-4">
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
            For private clients, events, and venues across the Bay Area.
          </p>
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
              <ReviewCard review={item} />
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="max-w-6xl mx-auto mt-6">
        <p className="font-body text-[10px] text-foreground/30 leading-relaxed max-w-2xl">
          Testimonials reflect individual client experiences. Names may be initials or stage names at each client&rsquo;s request. Individual results vary and are not guaranteed. No clients were compensated in cash; some received complimentary sessions. Educational information only — not medical advice.
        </p>
      </div>

      <style>{`
        /* Fade right edge only — left padding already frames the first card */
        .reviews-fade-wrap {
          -webkit-mask-image: linear-gradient(to right, #000 0%, #000 92%, transparent 100%);
                  mask-image: linear-gradient(to right, #000 0%, #000 92%, transparent 100%);
        }
        .reviews-fade-wrap ::-webkit-scrollbar { display: none; }

        /* Logo marquee */
        .logo-strip-wrap {
          overflow: hidden;
          -webkit-mask-image: linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%);
                  mask-image: linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%);
        }
        .logo-strip-track {
          display: flex;
          align-items: center;
          width: max-content;
          flex-wrap: nowrap;
          gap: 0;
          animation: logo-strip-scroll 14s linear infinite;
          will-change: transform;
          padding: 0.25rem 0;
        }
        @media (min-width: 768px) {
          .logo-strip-track { animation-duration: 18s; }
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
