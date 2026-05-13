import React, { useRef } from 'react';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

// ── Featured (punchy / notable clients) — shown first ──────────────────────
const FEATURED = [
  { name: 'J.G.',       tag: 'NAD+ IV',         quote: "I'm a founder who codes 20hrs a day now. NAD+ makes it happen." },
  { name: 'Diplo',      tag: 'Energy IV',        quote: 'That was awesome.' },
  { name: 'R.D.',       tag: 'NAD+ 1000mg',      quote: "I love NAD+. I knock one out before any big pitch. It's part of my routine now." },
  { name: 'Larry June', tag: 'Recovery IV',      quote: 'That IV did digits.' },
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
  // Generate initials from name
  const initials = item.name.replace(/\./g, '').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <article className="rounded-2xl border border-accent/25 bg-accent/[0.04] p-5 flex flex-col gap-3 w-[240px] shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full border border-accent/50 flex items-center justify-center bg-accent/[0.08] shrink-0">
          <span className="font-heading text-xs text-foreground tracking-wide">{initials}</span>
        </div>
        <div>
          <p className="font-body text-xs font-semibold text-foreground leading-tight">{item.name}</p>
          <span className="font-body text-[9px] tracking-[0.2em] uppercase text-accent/70">{item.tag}</span>
        </div>
      </div>
      <p className="font-body text-sm text-foreground/70 leading-relaxed flex-1">
        &ldquo;{item.quote}&rdquo;
      </p>
    </article>
  );
}

// Standard review card — longer quote, stars, date
function ReviewCard({ review }) {
  return (
    <article className="rounded-2xl bg-foreground/[0.04] border border-foreground/[0.07] p-5 flex flex-col gap-3 w-[280px] shrink-0">
      <StarRow count={review.stars} />
      <p className="font-body text-sm text-foreground/75 leading-relaxed flex-1">
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

export default function Reviews() {
  const scrollRef = useRef(null);

  return (
    <section aria-label="Client reviews" className="py-16 md:py-20">
      {/* Header */}
      <div className="px-5 md:px-12 lg:px-20 max-w-6xl mx-auto mb-8 md:mb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
            Client Experiences
          </p>
          <h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-none">
            What They&rsquo;re Saying
          </h2>
        </motion.div>
      </div>

      {/* Combined carousel — featured first, then long-form reviews */}
      <div className="reviews-fade-wrap">
        <div
          ref={scrollRef}
          className="flex gap-4 px-5 md:px-12 lg:px-20 overflow-x-auto pb-2"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x mandatory',
            overscrollBehaviorX: 'none',
          }}
          role="region"
          aria-label="Reviews carousel — scroll to see more"
        >
          {FEATURED.map((item, i) => (
            <div key={`featured-${i}`} style={{ scrollSnapAlign: 'start' }} className="shrink-0">
              <FeaturedCard item={item} />
            </div>
          ))}
          {REVIEWS.map((review, i) => (
            <div key={`review-${i}`} style={{ scrollSnapAlign: 'start' }} className="shrink-0">
              <ReviewCard review={review} />
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-5 md:px-12 lg:px-20 max-w-6xl mx-auto mt-6">
        <p className="font-body text-[10px] text-foreground/30 leading-relaxed max-w-2xl">
          Testimonials reflect individual client experiences. Names may be initials or stage names at each client&rsquo;s request. Individual results vary and are not guaranteed. No clients were compensated in cash; some received complimentary sessions. Educational information only — not medical advice.
        </p>
      </div>

      <style>{`
        .reviews-fade-wrap {
          -webkit-mask-image: linear-gradient(to right, transparent 0, #000 5%, #000 95%, transparent 100%);
                  mask-image: linear-gradient(to right, transparent 0, #000 5%, #000 95%, transparent 100%);
        }
        .reviews-fade-wrap ::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  );
}
