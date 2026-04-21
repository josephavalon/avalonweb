import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Zap, Sparkles, TestTube, Heart, Scissors, Pill, Apple, Link, Leaf, MapPin, Dumbbell, Lightbulb, Flame, CircleUser, ChevronLeft, ChevronRight } from 'lucide-react';
import CannabisLeaf from '@/components/icons/CannabisLeaf';

const verticals = [
  { label: 'IV Vitamins', icon: Droplets, live: true },
  { label: 'NAD+', icon: Zap, live: true },
  { label: 'CBD', icon: CannabisLeaf, live: true },
  { label: 'Exosomes', icon: Sparkles, live: true },
  { label: 'Contrast Therapy', icon: Flame, live: true, location: 'Vital Ice SF' },
  { label: 'Peptides', icon: Link, live: false },
  { label: 'Recovery Devices', icon: Lightbulb, live: false },
  { label: 'Personalized Protocols', icon: Zap, live: false },
  { label: 'Blood & Genetic Testing', icon: TestTube, live: false },
  { label: 'Sexual Wellness', icon: Heart, live: false },
  { label: 'Personal Fitness', icon: Dumbbell, live: false },
  { label: 'HRT', icon: Pill, live: false },
  { label: 'Supplements', icon: Pill, live: false },
  { label: 'Diet', icon: Apple, live: false },
  { label: 'Aesthetics', icon: CircleUser, live: false },
];

export default function IntroSection() {
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
    <section className="py-8 md:py-10 px-4 border-t border-border">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <motion.p 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-4"
          >
            The Foundation
          </motion.p>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="font-heading text-5xl md:text-7xl text-foreground tracking-wide mb-8"
          >
            IV THERAPY<br />IS THE BASE
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="font-body text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-12"
          >
            IV therapy is the bedrock. Every other modality builds on top — delivered by licensed clinicians, wherever you are, or visit us in San Francisco.
          </motion.p>

          {/* Scrollable cards - reveals SOON items on scroll */}
          <div className="relative group">
           <button
             onClick={() => scroll('left')}
             className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
             aria-label="Scroll left"
           >
             <ChevronLeft className="w-5 h-5 text-foreground" />
           </button>
           <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
             <div ref={scrollRef} className="flex px-4 md:px-0" style={{ scrollBehavior: 'smooth', width: 'fit-content' }}>
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 md:gap-4" style={{ gridAutoRows: 'minmax(140px, 1fr)', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
                 {verticals.map(({ label, icon: Icon, live, location, isLocation }, i) => (
                 <div
                   key={label}
                   className={`relative flex flex-col items-center justify-center gap-2 border rounded-3xl p-4 transition-colors ${
                     live
                       ? 'border-foreground/25 bg-card text-foreground'
                       : 'border-border bg-card/40 text-muted-foreground/40'
                   }`}
                 >
                   <Icon
                     className={`w-5 h-5 ${live ? 'text-accent' : 'text-muted-foreground/30'}`}
                     strokeWidth={1.5}
                   />
                   <span className="font-body text-[9px] tracking-[0.15em] uppercase leading-tight text-center">
                     {label}
                   </span>
                   {location && (
                     <span className="font-body text-[7px] tracking-widest text-accent uppercase">In Studio</span>
                   )}
                   {live && !isLocation && (
                     <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-accent" />
                   )}
                   {!live && (
                     <span className="font-body text-[8px] tracking-widest text-muted-foreground/30 uppercase">Soon</span>
                   )}
                   </div>
                   ))}
               </div>
             </div>
           </div>
           <button
             onClick={() => scroll('right')}
             className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-colors"
             aria-label="Scroll right"
           >
             <ChevronRight className="w-5 h-5 text-foreground" />
           </button>
          </div>

          <p className="mt-6 text-center font-body text-[10px] tracking-widest text-muted-foreground/40 uppercase">
            <span className="inline-block w-2 h-2 rounded-full bg-accent mr-2 align-middle" />
            Live at launch
          </p>
          <style>{`.flex::-webkit-scrollbar { display: none; }`}</style>
        </motion.div>
      </div>
    </section>
  );
}