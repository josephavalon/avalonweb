import React, { useRef } from 'react';
import { motion } from 'framer-motion';

const testimonials = [
  {
    quote: "Completely wiped after a red-eye. Nurse showed up in 45 minutes. Within an hour I felt like a different person—hydrated, focused, ready for meetings.",
    name: "A.R.",
    tag: "HYDRATION IV"
  },
  {
    quote: "Used to lose entire Saturdays recovering. Now I book a morning session and I'm back to 100% by lunch. Life-changing for weekends.",
    name: "M.T.",
    tag: "HANGOVER IV"
  },
  {
    quote: "The NAD+ IV is next level. Mental clarity after a 1000mg session lasts for days. I do one before any big pitch. Part of my founder toolkit.",
    name: "J.L.",
    tag: "NAD+ 1000MG"
  },
  {
    quote: "Competitive athlete here. Recovery is everything. Since adding biweekly IVs my recovery time cut in half. Hitting PRs I haven't seen in years.",
    name: "K.D.",
    tag: "ATHLETIC RECOVERY"
  },
  {
    quote: "Booked Avalon for our team during BottleRock. They set up a recovery lounge backstage. Whole crew back on their feet same day.",
    name: "S.P.",
    tag: "EVENT RECOVERY"
  },
  {
    quote: "CBD IV—never tried it before. Zero THC, pure calm. Slept better than in months. Already scheduled my next session.",
    name: "D.K.",
    tag: "CBD IV"
  },
];

function IPhoneMockup({ testimonial, offset = 0 }) {
  return (
    <div
      className="relative shrink-0"
      style={{
        width: 240,
        transform: `rotate(${offset}deg)`,
        transformOrigin: 'bottom center',
      }}
    >
      {/* Phone shell */}
      <div className="relative bg-black rounded-[40px] p-[8px] shadow-2xl"
        style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.1)' }}
      >
        {/* Screen */}
        <div className="bg-white rounded-[35px] overflow-hidden" style={{ minHeight: 500 }}>
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 pt-2 pb-2 bg-white">
            <span className="text-black text-[13px] font-semibold">9:41</span>
            <div className="w-24 h-5 bg-black rounded-full" />
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
          <div className="px-4 pt-4 pb-6 flex flex-col gap-3 bg-white" style={{ minHeight: 420 }}>
            {/* Message with tag visible */}
            <div className="flex gap-2 items-start justify-start">
              <div className="flex flex-col gap-2 flex-1">
                <div className="bg-gray-150 rounded-3xl rounded-bl-sm px-4 py-2.5">
                  <p className="text-black text-[13px] leading-[1.45] font-normal">
                    {testimonial.quote}
                  </p>
                </div>
                {/* Tag inline with message */}
                <span className="text-[9px] tracking-widest text-yellow-600 font-semibold uppercase ml-2 bg-yellow-50 px-2.5 py-0.5 rounded-full inline-block w-fit">
                  {testimonial.tag}
                </span>
              </div>
            </div>
          </div>

          {/* Home indicator */}
          <div className="flex justify-center pb-2 bg-white">
            <div className="w-28 h-1 bg-black rounded-full" />
          </div>
        </div>
      </div>

      {/* Side buttons */}
      <div className="absolute left-[-8px] top-24 w-[4px] h-8 bg-black rounded-l" />
      <div className="absolute left-[-8px] top-36 w-[4px] h-10 bg-black rounded-l" />
      <div className="absolute left-[-8px] top-52 w-[4px] h-10 bg-black rounded-l" />
      <div className="absolute right-[-8px] top-32 w-[4px] h-16 bg-black rounded-r" />

      {/* Name label */}
      <p className="text-center font-body text-[10px] tracking-widest text-foreground uppercase font-semibold mt-3">{testimonial.name}</p>
    </div>
  );
}

const offsets = [-6, 0, 5, -4, 2, -3];

export default function Testimonials() {
  const scrollRef = useRef(null);

  return (
    <section className="py-8 md:py-10 px-4 border-t border-border overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-8"
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