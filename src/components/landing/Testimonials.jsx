import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const testimonials = [
  {
    quote: "I'm a founder who codes 20hrs a day now. Avalon's NAD+ offerings make it happen.",
    name: "J.G.",
    tag: "NAD+ IV"
  },
  {
    quote: "That was awesome.",
    name: "Diplo",
    tag: "ENERGY IV"
  },
  {
    quote: "The NAD+ IV is next level. Mental clarity after a 1000mg session lasts for days. I do one before any big pitch. Part of my founder toolkit.",
    name: "R.D.",
    tag: "NAD+ 1000MG"
  },
  {
    quote: "That IV did digits.",
    name: "Larry June",
    tag: "RECOVERY IV"
  },
  {
    quote: "Used to lose entire Saturdays recovering. Now I book a morning session and I'm back to 100% by lunch. Life-changing for weekends.",
    name: "J.L.",
    tag: "HANGOVER IV"
  },
  {
    quote: "Competitive athlete here. Recovery is everything. Since adding biweekly IVs my recovery time cut in half. Hitting PRs I haven't seen in years.",
    name: "A.G.",
    tag: "ATHLETIC RECOVERY"
  },
  {
    quote: "Booked Avalon for our team during BottleRock. They set up a recovery lounge backstage. Whole crew back on their feet same day.",
    name: "G.B.",
    tag: "EVENT RECOVERY"
  },
  {
    quote: "CBD IV—never tried it before. Zero THC, pure calm. Slept better than in months. Already scheduled my next session.",
    name: "C.A.",
    tag: "CBD IV"
  },
];

function IPhoneMockup({ testimonial }) {
  return (
    <div
      className="relative shrink-0"
      style={{
        width: 160,
      }}
    >
      {/* Phone shell */}
      <div className="relative bg-black rounded-[28px] p-1.5 shadow-2xl"
        style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.1)' }}
      >
        {/* Screen */}
        <div className="bg-white rounded-[24px] overflow-hidden" style={{ minHeight: 340 }}>
          {/* Status bar */}
          <div className="flex items-center justify-between px-3 pt-1.5 pb-1 bg-white">
            <span className="text-black text-[9px] font-semibold">9:41</span>
            <div className="w-16 h-3 bg-black rounded-full" />
            <div className="flex items-center gap-0.5">
              <div className="flex gap-0.5 items-end h-3">
                {[2, 3, 4, 5].map(h => (
                  <div key={h} className="w-0.5 bg-black rounded-sm" style={{ height: h * 1.8 }} />
                ))}
              </div>
              <svg className="w-3.5 h-3.5 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 6.75V17.25C16 17.665 15.665 18 15.25 18H8.75C8.335 18 8 17.665 8 17.25V6.75C8 6.335 8.335 6 8.75 6H9.5V5.5C9.5 5.224 9.724 5 10 5H14C14.276 5 14.5 5.224 14.5 5.5V6H15.25C15.665 6 16 6.335 16 6.75Z"/>
              </svg>
            </div>
          </div>

          {/* Messages area - SMS style */}
          <div className="px-2.5 pt-2.5 pb-3 flex flex-col gap-2 bg-white" style={{ minHeight: 280 }}>
            {/* Message with tag visible */}
            <div className="flex gap-1.5 items-start justify-start">
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="bg-gray-150 rounded-2xl rounded-bl-sm px-2.5 py-1.5">
                  <p className="text-black text-[10px] leading-[1.4] font-normal">
                    {testimonial.quote}
                  </p>
                </div>
                {/* Tag inline with message */}
                <span className="text-[7px] tracking-widest text-yellow-600 font-semibold uppercase ml-1.5 bg-yellow-50 px-1.5 py-0.5 rounded-full inline-block w-fit">
                  {testimonial.tag}
                </span>
              </div>
            </div>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-1 bg-white">
            <div className="w-20 h-0.5 bg-black rounded-full" />
          </div>
        </div>
      </div>

      {/* Side buttons */}
      <div className="absolute left-[-5px] top-16 w-[3px] h-6 bg-black rounded-l" />
      <div className="absolute left-[-5px] top-24 w-[3px] h-7 bg-black rounded-l" />
      <div className="absolute left-[-5px] top-32 w-[3px] h-7 bg-black rounded-l" />
      <div className="absolute right-[-5px] top-20 w-[3px] h-12 bg-black rounded-r" />

      {/* Name label */}
      <p className="text-center font-body text-[8px] tracking-widest text-foreground uppercase font-semibold mt-2">{testimonial.name}</p>
    </div>
  );
}

export default function Testimonials() {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="py-8 md:py-6 px-4 border-t border-border">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-left mb-8"
      >
        <h2 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide">REAL RESULTS</h2>
        <p className="font-body text-xs text-muted-foreground tracking-widest uppercase mt-3">From our clients</p>
      </motion.div>

      {/* Scrollable iPhone row - shows 2 at a time */}
      <div className="overflow-x-auto relative group">
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
          className="flex gap-6 pb-2 px-16 md:px-4 md:pr-32 items-center w-fit"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollBehavior: 'smooth' }}
        >
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.7 }}
            >
              <IPhoneMockup testimonial={t} />
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`.flex::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}