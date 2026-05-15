import React, { useRef } from 'react';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

// Clearbit Logo API — returns brand logo from domain, white-filtered for dark bg.
// onError falls back to the name text so the strip never breaks.
const CLIENT_LOGOS = [
  { name: '111 Minna',      src: 'https://logo.clearbit.com/111minna.com' },
  { name: 'Secret Party',   src: 'https://logo.clearbit.com/secretparty.com' },
  { name: 'Hereticon',      src: 'https://logo.clearbit.com/hereticon.com' },
  { name: 'Maxim Magazine', src: 'https://logo.clearbit.com/maxim.com' },
  { name: 'SF Pride',       src: 'https://logo.clearbit.com/sfpride.org' },
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

// Featured card — compact, punchy, accent-bordered
function FeaturedCard({ item }) {
  const initials = item.name.replace(/\./g, '').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <article className="rounded-2xl border border-accent/25 bg-accent/[0.04] p-5 flex flex-col gap-3 w-[280px] shrink-0 h-full">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full border border-accent/50 flex items-center justify-center bg-accent/[0.08] shrink-0">
          <span className="font-heading text-xs text-foreground tracking-wide">{initials}</span>
        </div>
        <div>
          <p className="font-body text-xs font-semibold text-foreground leading-tight">{item.name}</p>
          <span className="font-body text-[9px] tracking-[0.2em] uppercase text-accent/70">{item.tag}</span>
        </div>
      </div>
      <p className="font-body text-sm text-foreground/70 leading-relaxed">
        &ldquo;{item.quote}&rdquo;
      </p>
    </article>
  );
}

// Standard review card — longer quote, stars, date
function ReviewCard({ review }) {
  return (
    <article className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.07] p-5 flex flex-col gap-3 w-[280px] shrink-0 h-full">
      <StarRow count={review.stars} />
      <p className="font-body text-sm text-foreground/75 leading-relaxed line-clamp-5">
        &ldquo;{review.quote}&rdquo;
      </p>
      <div className="flex items-center justify-between flex-wrap gap-2 mt-auto">
        <div>
          <p className="font-body text-xs font-semibold text-foreground">{review.name}</p>
          <p className="font-body text-[10px] text-foreground/35 mt-0.5">{review.date}</p>
        </div>
        <span className="inline-block px-2.5 py-1 rounded-full bg-foreground/[0.06] font-body text-[9px] tracking-[0.2em] uppercase text-foreground/50">
          {review.tag}
        </span>
      </div>
    </article>
  );
}

// Logo item — image with graceful text fallback if Clearbit doesn't have it
function LogoItem({ logo }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  if (imgFailed) {
    return (
      <span className="font-heading text-xs tracking-[0.18em] uppercase text-foreground/25 whitespace-nowrap">
        {logo.name}
      </span>
    );
  }
  return (
    <img
      src={logo.src}
      alt={logo.name}
      onError={() => setImgFailed(true)}
      className="h-5 w-auto object-contain"
      style={{ filter: 'brightness(0) invert(1)', opacity: 0.35 }}
      loading="lazy"
    />
  );
}

// Logo marquee row — duplicated for seamless loop
function LogoRow({ ariaHidden = false }) {
  return (
    <ul
      aria-hidden={ariaHidden}
      className="flex items-center gap-8 md:gap-12 shrink-0 list-none m-0 p-0"
    >
      {CLIENT_LOGOS.map((logo, i) => (
        <React.Fragment key={`${ariaHidden ? 'b' : 'a'}-${i}`}>
          {i > 0 && (
            <li aria-hidden="true" className="w-[3px] h-[3px] rounded-full bg-foreground/10 shrink-0" />
          )}
          <li className="shrink-0 flex items-center">
            <LogoItem logo={logo} />
          </li>
        </React.Fragment>
      ))}
      <li aria-hidden="true" className="w-[3px] h-[3px] rounded-full bg-foreground/10 shrink-0" />
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
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
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
          <div className="w-10 h-[2px] bg-accent mt-4" />
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
          {FEATURED.map((item, i) => (
            <div key={`featured-${i}`} style={{ scrollSnapAlign: 'start' }} className="shrink-0 flex self-stretch">
              <FeaturedCard item={item} />
            </div>
          ))}
          {REVIEWS.map((review, i) => (
            <div key={`review-${i}`} style={{ scrollSnapAlign: 'start' }} className="shrink-0 flex self-stretch">
              <ReviewCard review={review} />
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
          gap: 2rem;
          animation: logo-strip-scroll 14s linear infinite;
          will-change: transform;
          padding: 0.25rem 0;
        }
        @media (min-width: 768px) {
          .logo-strip-track { gap: 3rem; animation-duration: 18s; }
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
