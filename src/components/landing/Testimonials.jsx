import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const testimonials = [
  {
    quote: "I\u2019m a founder who codes 20hrs a day now. NAD+ makes it happen.",
    name: "J.G.",
    tag: "NAD+ IV"
  },
  {
    quote: "That was awesome.",
    name: "Diplo",
    tag: "ENERGY IV"
  },
  {
    quote: "I love NAD+. I knock one out before any big pitch. It's part of my routine now.",
    name: "R.D.",
    tag: "NAD+ 1000MG"
  },
  {
    quote: "That IV did digits.",
    name: "Larry June",
    tag: "RECOVERY IV"
  },
  {
    quote: "I'm an AI founder. Every day I gain new abilities. Avalon holds me down through the storm.",
    name: "J.L.",
    tag: "PERFORMANCE IV"
  },
  {
    quote: "Beauty IV is my weekly. Glutathione drip, every time.",
    name: "A.G.",
    tag: "BEAUTY IV"
  },
  {
    quote: "Booked Avalon for a festival. Green room was lit. They set up an entire recovery lounge backstage. Artists and crew loved it.",
    name: "G.B.",
    tag: "EVENT RECOVERY"
  },
  {
    quote: "Who knew CBD IVs were a thing? Zero THC. The most relaxing drip experience I've had. Already booked my next bag.",
    name: "C.A.",
    tag: "CBD IV"
  },
].sort((a, b) => {
  const order = { 'J.G.': 0, 'Diplo': 1, 'R.D.': 2 };
  return (order[a.name] ?? 999) - (order[b.name] ?? 999);
});

// Apple system font stack for all on-screen UI
const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif';

function StatusBar() {
  return (
    <div className="relative flex items-center justify-between px-3.5 pt-1.5 pb-1 bg-white" style={{ height: 22 }}>
      {/* Time */}
      <span
        className="text-black z-10"
        style={{ fontFamily: APPLE_FONT, fontSize: 10, fontWeight: 600, letterSpacing: '-0.02em' }}
      >
        9:41
      </span>

      {/* Dynamic Island */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bg-black rounded-full"
        style={{ top: 4, width: 58, height: 16 }}
      />

      {/* Right icons */}
      <div className="flex items-center gap-[3px] z-10">
        {/* Signal bars */}
        <svg width="14" height="8" viewBox="0 0 14 8" fill="black">
          <rect x="0" y="5" width="2.2" height="3" rx="0.5" />
          <rect x="3.4" y="3.5" width="2.2" height="4.5" rx="0.5" />
          <rect x="6.8" y="1.8" width="2.2" height="6.2" rx="0.5" />
          <rect x="10.2" y="0" width="2.2" height="8" rx="0.5" />
        </svg>
        {/* Wifi */}
        <svg width="11" height="8" viewBox="0 0 16 11" fill="black">
          <path d="M8 10.2c.62 0 1.12-.5 1.12-1.12S8.62 7.96 8 7.96s-1.12.5-1.12 1.12S7.38 10.2 8 10.2z" />
          <path d="M3.7 6.7c-.28.28-.28.73 0 1.01.28.28.73.28 1.01 0C6.04 6.39 7.96 5.7 10 5.7s3.96.69 5.29 2.01c.28.28.73.28 1.01 0 .28-.28.28-.73 0-1.01C14.68 5.1 12.42 4.3 8 4.3 5.58 4.3 3.32 5.1 1.7 6.7h2z" transform="translate(0,0)" />
          <path d="M1.4 3.9c-.28.28-.28.73 0 1.01.28.28.73.28 1.01 0C4.25 3.07 6.06 2.3 8 2.3s3.75.77 5.59 2.61c.28.28.73.28 1.01 0 .28-.28.28-.73 0-1.01C12.49 1.81 10.33 1 8 1S3.51 1.81 1.4 3.9z" />
        </svg>
        {/* Battery */}
        <div className="flex items-center" style={{ marginLeft: 1 }}>
          <div
            className="relative flex items-center"
            style={{ width: 22, height: 10, border: '1px solid rgba(0,0,0,0.35)', borderRadius: 3, padding: 1 }}
          >
            <div style={{ width: '85%', height: '100%', background: 'black', borderRadius: 1.5 }} />
          </div>
          <div style={{ width: 1.5, height: 4, background: 'rgba(0,0,0,0.35)', marginLeft: 0.5, borderRadius: '0 1px 1px 0' }} />
        </div>
      </div>
    </div>
  );
}

function ContactHeader({ name }) {
  // iOS Messages thread header: back chevron | centered avatar + name › | FaceTime icon
  const initials = name.replace(/\./g, '').slice(0, 2).toUpperCase();
  return (
    <div
      className="relative flex items-start justify-between bg-white"
      style={{ padding: '4px 10px 5px', minHeight: 46, borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}
    >
      {/* Back chevron — vertically aligned against avatar center */}
      <div className="flex items-center justify-center shrink-0" style={{ width: 20, height: 20, marginTop: 6 }}>
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
          <path d="M6 1L1 6L6 11" stroke="#007AFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Centered avatar + name + chevron */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ top: 4 }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(140deg, #cfcfd4 0%, #8e8e93 100%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}
        >
          <span
            style={{
              fontFamily: APPLE_FONT,
              fontSize: 10,
              fontWeight: 600,
              color: 'white',
              letterSpacing: '0.02em',
            }}
          >
            {initials}
          </span>
        </div>
        <div className="flex items-center gap-[2px] mt-[1px]">
          <span
            style={{
              fontFamily: APPLE_FONT,
              fontSize: 8,
              fontWeight: 400,
              color: '#000',
              letterSpacing: '-0.01em',
            }}
          >
            {name}
          </span>
          <svg width="4" height="7" viewBox="0 0 4 7" fill="none">
            <path d="M0.8 0.8L3 3.5L0.8 6.2" stroke="#9a9a9f" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* FaceTime video */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: 22, height: 22, borderRadius: '50%', background: '#f1f1f4', marginTop: 4 }}
      >
        <svg width="11" height="8" viewBox="0 0 16 11" fill="#007AFF">
          <path d="M1.5 1.5A1 1 0 0 1 2.5 0.5H10A1 1 0 0 1 11 1.5V9.5A1 1 0 0 1 10 10.5H2.5A1 1 0 0 1 1.5 9.5V1.5Z" />
          <path d="M12 3.5L15 1.7V9.3L12 7.5V3.5Z" />
        </svg>
      </div>
    </div>
  );
}

function IMessageInputBar() {
  return (
    <div
      className="flex items-center gap-1 bg-white"
      style={{ padding: '6px 8px 7px', borderTop: '0.5px solid rgba(0,0,0,0.06)' }}
    >
      {/* Plus button */}
      <div
        className="flex items-center justify-center shrink-0"
        style={{ width: 18, height: 18, borderRadius: '50%', background: '#f1f1f4' }}
      >
        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
          <path d="M5 1V9M1 5H9" stroke="#8e8e93" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </div>
      {/* Input pill */}
      <div
        className="flex-1 flex items-center"
        style={{
          height: 18,
          borderRadius: 999,
          border: '0.5px solid rgba(0,0,0,0.15)',
          padding: '0 8px',
          background: '#fff',
        }}
      >
        <span
          style={{
            fontFamily: APPLE_FONT,
            fontSize: 8,
            color: '#9a9a9f',
            letterSpacing: '-0.01em',
          }}
        >
          iMessage
        </span>
      </div>
      {/* Mic */}
      <div className="flex items-center justify-center shrink-0" style={{ width: 14, height: 14 }}>
        <svg width="7" height="10" viewBox="0 0 8 12" fill="none">
          <rect x="2.5" y="1" width="3" height="6" rx="1.5" fill="#8e8e93" />
          <path d="M1 6.5V7a3 3 0 0 0 6 0v-0.5M4 10.5V12" stroke="#8e8e93" strokeWidth="0.8" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

function IPhoneMockup({ testimonial }) {
  const FRAME_W = 172;

  return (
    <div className="relative shrink-0" style={{ width: FRAME_W }}>
      {/* Outer frame (titanium edge) */}
      <div
        className="relative"
        style={{
          borderRadius: 34,
          padding: 3,
          background: 'linear-gradient(145deg, #3a3a3c 0%, #1c1c1e 40%, #2c2c2e 70%, #0a0a0a 100%)',
          boxShadow:
            '0 28px 55px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Inner bezel */}
        <div
          style={{
            borderRadius: 31,
            padding: 2,
            background: '#000',
          }}
        >
          {/* Screen */}
          <div
            className="relative bg-white overflow-hidden flex flex-col"
            style={{ borderRadius: 29, minHeight: 348 }}
          >
            <StatusBar />
            <ContactHeader name={testimonial.name} />

            {/* Messages area — grows to push input to the bottom */}
            <div className="flex-1 flex flex-col bg-white" style={{ padding: '10px 8px 8px' }}>
              <div className="flex items-end gap-1">
                <div className="flex flex-col items-start" style={{ maxWidth: '82%' }}>
                  {/* Received bubble — gray, tail bottom-left */}
                  <div
                    style={{
                      backgroundColor: '#E9E9EB',
                      borderRadius: 16,
                      borderBottomLeftRadius: 4,
                      padding: '6px 10px 7px',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: APPLE_FONT,
                        fontSize: 10,
                        lineHeight: 1.32,
                        color: '#000',
                        letterSpacing: '-0.01em',
                        margin: 0,
                      }}
                    >
                      {testimonial.quote}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* iMessage input bar — sits flush with the bottom edge */}
            <IMessageInputBar />
          </div>
        </div>
      </div>

      {/* Side buttons — silence ring, volume up/down, power */}
      <div className="absolute" style={{ left: -2, top: 48, width: 2.5, height: 16, background: '#1c1c1e', borderRadius: '2px 0 0 2px' }} />
      <div className="absolute" style={{ left: -2, top: 76, width: 2.5, height: 26, background: '#1c1c1e', borderRadius: '2px 0 0 2px' }} />
      <div className="absolute" style={{ left: -2, top: 112, width: 2.5, height: 26, background: '#1c1c1e', borderRadius: '2px 0 0 2px' }} />
      <div className="absolute" style={{ right: -2, top: 82, width: 2.5, height: 44, background: '#1c1c1e', borderRadius: '0 2px 2px 0' }} />
    </div>
  );
}

export default function Testimonials() {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      if (direction === 'left' && scrollRef.current.scrollLeft <= 0) {
        return;
      }
      const scrollAmount = scrollRef.current.clientWidth;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="py-8 md:py-6 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-left mb-4 md:mb-8"
        >
          <motion.p
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[10px] tracking-[0.35em] text-accent font-body uppercase mb-4"
          >
            From our clients
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide md:whitespace-nowrap"
          >
            REAL RESULTS
          </motion.h2>
        </motion.div>
      </div>

      {/* Horizontal-only scroller — no vertical scroll, cards pinned/static */}
      <div className="overflow-x-auto overflow-y-hidden relative group snap-x snap-mandatory">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute right-4 md:right-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
        <div
          ref={scrollRef}
          className="flex gap-5 md:gap-8 pb-2 items-start px-[calc(50%-140px)] md:px-[calc(50%-180px)]"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth' }}
        >
          {testimonials.map((t, i) => (
            <div key={i} className="snap-center shrink-0">
              <IPhoneMockup testimonial={t} />
            </div>
          ))}
        </div>
      </div>

      {/* FTC 16 CFR §255 disclosure. Plain-language material connection +
          typical-results language. Required before any paid-media spend;
          currently belt-and-suspenders while paid is inactive. */}
      <div className="max-w-6xl mx-auto px-4 mt-8 md:mt-10">
        <p className="font-body text-xs md:text-sm tracking-[0.05em] text-muted-foreground/80 leading-relaxed max-w-3xl">
          Testimonials reflect the individual experience of real Avalon clients.
          Names and handles may be initials or stage names at each client's
          request. Individual experiences vary; results are not typical and are
          not guaranteed. No clients were compensated in cash for these
          statements; some received complimentary sessions. Educational
          information only — not medical advice. Not intended to diagnose,
          treat, cure, or prevent any condition.
        </p>
      </div>

      <style>{`.flex::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}
