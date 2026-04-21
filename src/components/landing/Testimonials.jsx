import React, { useRef } from 'react';
import { motion } from 'framer-motion';

const testimonials = [
  {
    quote: "I was completely wiped after a red-eye flight. The nurse arrived at my hotel in 45 minutes. Within an hour I felt like a completely different person — hydrated, focused, and ready for my meetings.",
    name: "A.R.",
    tag: "Dehydration IV"
  },
  {
    quote: "I used to lose entire Saturdays recovering. Now I book a morning session and I'm back to 100% by lunch. Genuinely life-changing for my weekends.",
    name: "M.T.",
    tag: "Hangover IV"
  },
  {
    quote: "The NAD+ IV is next level. My mental clarity after a 1000mg session lasts for days. I do one before any big pitch or launch. It's become part of my founder toolkit.",
    name: "J.L.",
    tag: "NAD+ 1000mg"
  },
  {
    quote: "As a competitive athlete, recovery is everything. Since adding biweekly IVs my recovery time has cut in half. I'm hitting PRs I haven't seen in years.",
    name: "K.D.",
    tag: "Performance IV"
  },
  {
    quote: "We booked Avalon for our entire team during BottleRock. They set up a recovery lounge backstage — the whole crew was back on their feet same day.",
    name: "S.P.",
    tag: "Event Recovery IV"
  },
  {
    quote: "The CBD IV was something I'd never tried before. Zero THC, pure calm. Slept better than I have in months. Already scheduled my next session.",
    name: "D.K.",
    tag: "CBD IV"
  },
];

function IPhoneMockup({ testimonial, offset = 0 }) {
  return (
    <div
      className="relative shrink-0"
      style={{
        width: 220,
        transform: `rotate(${offset}deg)`,
        transformOrigin: 'bottom center',
      }}
    >
      {/* Phone shell */}
      <div className="relative bg-[#1a1a1a] rounded-[36px] p-[3px] shadow-2xl"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.08)' }}
      >
        {/* Screen */}
        <div className="bg-[#111] rounded-[33px] overflow-hidden" style={{ minHeight: 420 }}>
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1">
            <span className="text-white text-[10px] font-semibold">9:41</span>
            <div className="w-16 h-4 bg-black rounded-full" />
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5 items-end h-3">
                {[2, 3, 4, 5].map(h => (
                  <div key={h} className="w-0.5 bg-white/70 rounded-sm" style={{ height: h * 2 }} />
                ))}
              </div>
              <span className="text-white text-[9px] font-semibold">5G</span>
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 6.75V17.25C16 17.665 15.665 18 15.25 18H8.75C8.335 18 8 17.665 8 17.25V6.75C8 6.335 8.335 6 8.75 6H9.5V5.5C9.5 5.224 9.724 5 10 5H14C14.276 5 14.5 5.224 14.5 5.5V6H15.25C15.665 6 16 6.335 16 6.75Z"/>
              </svg>
            </div>
          </div>

          {/* iMessage-style chat bubble area */}
          <div className="px-4 pt-4 pb-6 flex flex-col gap-3" style={{ minHeight: 360 }}>
            {/* Blurred "other" messages */}
            <div className="self-start flex gap-2 items-end">
              <div className="w-6 h-6 rounded-full bg-gray-600 shrink-0" />
              <div className="bg-[#2c2c2e] rounded-2xl rounded-bl-sm px-3 py-2 max-w-[130px]">
                <div className="h-2 bg-white/20 rounded mb-1.5 w-20" />
                <div className="h-2 bg-white/20 rounded w-14" />
              </div>
            </div>

            <div className="self-end">
              <div className="bg-[#0a84ff] rounded-2xl rounded-br-sm px-3 py-2 max-w-[130px]">
                <div className="h-2 bg-white/40 rounded mb-1.5 w-16" />
                <div className="h-2 bg-white/40 rounded w-10" />
              </div>
            </div>

            {/* Main testimonial bubble */}
            <div className="self-start flex gap-2 items-end mt-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 shrink-0" />
              <div className="bg-[#2c2c2e] rounded-2xl rounded-bl-sm px-3 py-2.5" style={{ maxWidth: 145 }}>
                <p className="text-white text-[10px] leading-[1.45] font-normal">
                  "{testimonial.quote}"
                </p>
              </div>
            </div>

            {/* Tag pill */}
            <div className="self-start ml-8">
              <span className="text-[8px] tracking-[0.15em] text-accent font-body uppercase bg-accent/10 border border-accent/30 rounded-full px-2 py-0.5">
                {testimonial.tag}
              </span>
            </div>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-3">
            <div className="w-20 h-1 bg-white/30 rounded-full" />
          </div>
        </div>
      </div>

      {/* Side buttons */}
      <div className="absolute left-[-3px] top-20 w-[3px] h-8 bg-[#2a2a2a] rounded-l-sm" />
      <div className="absolute left-[-3px] top-32 w-[3px] h-10 bg-[#2a2a2a] rounded-l-sm" />
      <div className="absolute left-[-3px] top-44 w-[3px] h-10 bg-[#2a2a2a] rounded-l-sm" />
      <div className="absolute right-[-3px] top-28 w-[3px] h-14 bg-[#2a2a2a] rounded-r-sm" />

      {/* Name label */}
      <p className="text-center font-body text-[9px] tracking-widest text-muted-foreground uppercase mt-3">{testimonial.name}</p>
    </div>
  );
}

const offsets = [-6, 0, 5, -4, 2, -3];

export default function Testimonials() {
  const scrollRef = useRef(null);

  return (
    <section className="py-16 md:py-24 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-14 px-4"
      >
        <h2 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide">REAL RESULTS</h2>
        <p className="font-body text-xs text-muted-foreground tracking-widest uppercase mt-3">From our clients</p>
      </motion.div>

      {/* Scrollable iPhone row */}
      <div
        ref={scrollRef}
        className="flex gap-8 overflow-x-auto pb-8 px-12 items-end"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {testimonials.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.7 }}
          >
            <IPhoneMockup testimonial={t} offset={offsets[i]} />
          </motion.div>
        ))}
      </div>

      <style>{`.flex::-webkit-scrollbar { display: none; }`}</style>
    </section>
  );
}