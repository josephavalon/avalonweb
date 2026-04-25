import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Droplet, Pill, Syringe, Dumbbell, Moon, ChevronRight, Wifi, Salad, Sun, X, ZoomIn, Truck, BarChart3, Brain, Orbit, Smartphone } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const LAYERS = [
  { n: 5, name: 'Autonomy', desc: 'Your protocol runs itself.', accentTail: 'Avalon delivers it.', icon: Orbit },
  { n: 4, name: 'Intelligence', desc: 'We learn what works.', icon: Brain },
  { n: 3, name: 'Data', desc: 'Everything tracked, end-to-end.', icon: BarChart3 },
  { n: 2, name: 'Modalities', desc: 'IVs, NAD+, peptides, TRT.', icon: Droplet },
  { n: 1, name: 'Delivery', desc: 'We ship or come to you.', icon: Truck },
];

const METRICS = [
  { label: 'HRV', value: '92', type: 'line', color: '#4ade80' },
  { label: 'SLEEP', value: '7h 48m', type: 'bars', color: '#a78bfa' },
  { label: 'RECOVERY', value: '94%', type: 'line', color: '#60a5fa' },
  { label: 'STRAIN', value: '83', type: 'line', color: '#fb923c' },
];

const PROTOCOL = [
  { time: '7:00', name: 'Hydration', detail: 'Electrolyte water · 500ml', icon: Droplet, ring: 'border-green-400/40 text-green-400', done: true },
  { time: '8:00', name: 'Vitamin Stack', detail: 'Multi · D3 · Omega-3', icon: Pill, ring: 'border-amber-400/40 text-amber-400', done: true },
  { time: '8:30', name: 'NMN', detail: '500mg', icon: Pill, ring: 'border-amber-300/40 text-amber-300', done: true },
  { time: '9:30', name: 'Diet · Breakfast', detail: 'Protein 40g · greens', icon: Salad, ring: 'border-emerald-400/40 text-emerald-400', done: true },
  { time: '10:00', name: 'BPC Injection', detail: '250mcg', icon: Syringe, ring: 'border-purple-400/40 text-purple-400', done: true },
  { time: '12:30', name: 'Water', detail: '1L · electrolytes', icon: Droplet, ring: 'border-cyan-400/40 text-cyan-400', done: true },
  { time: '1:00', name: 'Training', detail: 'Strength', icon: Dumbbell, ring: 'border-amber-500/40 text-amber-500', done: true },
  { time: '6:00', name: 'NAD+ IV + Red Light', detail: 'Clinic · 30 min', icon: Sun, ring: 'border-blue-400/40 text-blue-400', done: false },
  { time: '9:00', name: 'Recovery', detail: 'Magnesium · Glycine', icon: Moon, ring: 'border-purple-400/40 text-purple-400', done: true },
];

const AppleIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.94-3.08.43-1.09-.52-2.08-.55-3.23 0-1.45.7-2.21.49-3.08-.43C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.81 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.07zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

const AndroidIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.523 15.34c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-11.05 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm11.4-6.02l2-3.46a.42.42 0 00-.15-.57.42.42 0 00-.57.15l-2.02 3.5C15.59 8.24 13.85 7.85 12 7.85s-3.59.39-5.14 1.1L4.84 5.45a.42.42 0 00-.57-.15.42.42 0 00-.15.57l2 3.46C2.69 11.19.34 14.66 0 18.76h24c-.34-4.1-2.69-7.57-6.13-9.44z" />
  </svg>
);

function ComplianceRing({ percent, size = 'sm' }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  const sizeClass = size === 'lg' ? 'w-14 h-14' : 'w-8 h-8 md:w-10 md:h-10';
  const txtClass = size === 'lg' ? 'text-xs' : 'text-[7px] md:text-[10px]';
  return (
    <div className={`relative ${sizeClass}`}>
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke="#4ade80" strokeWidth="2.5" strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <p className={`${txtClass} font-bold text-white leading-none`}>{percent}%</p>
      </div>
    </div>
  );
}

function Sparkline({ color, type, large }) {
  const h = large ? 'h-4' : 'h-2 md:h-3';
  if (type === 'bars') {
    return (
      <svg viewBox="0 0 40 12" className={`w-full ${h} mt-0.5`} preserveAspectRatio="none">
        {[2, 5, 3, 6, 4, 7, 5, 8, 4, 6].map((i, idx) => (
          <rect key={idx} x={idx * 4} y={12 - i} width="2.5" height={i} fill={color} opacity="0.7" />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 12" className={`w-full ${h} mt-0.5`} preserveAspectRatio="none">
      <polyline points="0,8 6,6 12,9 18,5 24,7 30,3 36,5 40,2" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneMockup({ large = false }) {
  const wrapMax = large ? 'max-w-[320px]' : 'max-w-[185px] sm:max-w-[240px] md:max-w-[320px]';
  const radius = large ? 'rounded-[2.4rem]' : 'rounded-[1.3rem] md:rounded-[2.1rem]';
  const innerRadius = large ? 'rounded-[2rem]' : 'rounded-[1.1rem] md:rounded-[1.8rem]';
  const padX = large ? 'px-5' : 'px-2.5 md:px-4';
  const txTime = large ? 'text-xs' : 'text-[7px] md:text-[10px]';
  const todayLbl = large ? 'text-[10px]' : 'text-[5px] md:text-[8px]';
  const dateTx = large ? 'text-2xl' : 'text-[10px] md:text-xl';
  const tilesPad = large ? 'p-2' : 'p-1 md:p-1.5';
  const tileLbl = large ? 'text-[8px]' : 'text-[4px] md:text-[6px]';
  const tileVal = large ? 'text-[12px]' : 'text-[6px] md:text-[9px]';
  const protLbl = large ? 'text-[10px]' : 'text-[5px] md:text-[8px]';
  const rowGap = large ? 'space-y-1.5' : 'space-y-1';
  const rowTime = large ? 'text-[10px] w-12' : 'text-[5px] md:text-[7px] w-6 md:w-9';
  const rowIcon = large ? 'w-7 h-7' : 'w-3.5 h-3.5 md:w-5 md:h-5';
  const rowIconInner = large ? 'w-3.5 h-3.5' : 'w-2 h-2 md:w-2.5 md:h-2.5';
  const rowName = large ? 'text-[12px]' : 'text-[6px] md:text-[9px]';
  const rowDetail = large ? 'text-[10px]' : 'text-[4.5px] md:text-[7px]';
  const rowCheck = large ? 'w-4 h-4' : 'w-2 h-2 md:w-3 md:h-3';
  const rowCheckIcon = large ? 'w-2.5 h-2.5' : 'w-1 h-1 md:w-1.5 md:h-1.5';
  const tabTx = large ? 'text-[8px]' : 'text-[3.5px] md:text-[6px]';

  return (
    <div className={`relative w-full ${wrapMax} mx-auto pointer-events-none`}>
      <div className={`${radius} border border-foreground/30 bg-black p-1 md:p-1.5 shadow-2xl`}>
        <div className={`${innerRadius} bg-black overflow-hidden relative`} style={{ aspectRatio: '9/19.5' }}>
          <div className={`flex items-center justify-between ${padX} pt-2 pb-1`}>
            <span className={`${txTime} font-medium text-white`}>9:41</span>
            <div className="flex items-center gap-0.5 text-white">
              <Wifi className={large ? 'w-3.5 h-3.5' : 'w-2 h-2 md:w-3 md:h-3'} strokeWidth={2.5} />
              <div className={large ? 'w-5 h-2.5 border border-white rounded-sm relative' : 'w-2.5 h-1 md:w-3.5 md:h-1.5 border border-white rounded-sm relative'}>
                <div className="absolute inset-0.5 bg-white rounded-[1px]" />
              </div>
            </div>
          </div>
          <div className={`${padX} pt-1 flex items-start justify-between`}>
            <div>
              <p className={`${todayLbl} tracking-[0.3em] text-white/60 uppercase`}>Today</p>
              <p className={`font-heading ${dateTx} text-white tracking-wide leading-none mt-0.5`}>APR 24</p>
            </div>
            <ComplianceRing percent={98} size={large ? 'lg' : 'sm'} />
          </div>
          <div className={`mx-2.5 md:mx-4 mt-2 grid grid-cols-4 gap-0.5 md:gap-1 ${tilesPad} bg-white/5 rounded md:rounded-lg border border-white/10`}>
            {METRICS.map((m) => (
              <div key={m.label} className="text-center min-w-0">
                <p className={`${tileLbl} tracking-widest text-white/50 uppercase truncate`}>{m.label}</p>
                <p className={`${tileVal} font-semibold text-white truncate`}>{m.value}</p>
                <Sparkline color={m.color} type={m.type} large={large} />
              </div>
            ))}
          </div>
          <div className={`${padX} mt-2`}>
            <p className={`${protLbl} tracking-[0.3em] text-accent uppercase mb-1`}>Today's Protocol</p>
            <div className={rowGap}>
              {PROTOCOL.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.time + p.name} className="flex items-center gap-1 md:gap-1.5">
                    <p className={`${rowTime} text-white/60 shrink-0`}>{p.time}</p>
                    <div className={`${rowIcon} rounded-full border flex items-center justify-center shrink-0 ${p.ring}`}>
                      <Icon className={rowIconInner} strokeWidth={1.6} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`${rowName} font-medium text-white leading-tight truncate`}>{p.name}</p>
                      <p className={`${rowDetail} text-white/50 leading-tight truncate`}>{p.detail}</p>
                    </div>
                    <div className={`${rowCheck} rounded-full border flex items-center justify-center shrink-0 ${p.done ? 'border-green-400 text-green-400' : 'border-white/30'}`}>
                      {p.done && <Check className={rowCheckIcon} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 px-1.5 md:px-2.5 py-0.5 md:py-1 flex justify-between items-center bg-black">
            {['HOME', 'PROTOCOL', 'COACH', 'REPORTS', 'YOU'].map((t, i) => (
              <p key={t} className={`${tabTx} tracking-[0.15em] ${i === 0 ? 'text-accent' : 'text-white/40'}`}>{t}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AvalonOSPreview() {
  const [zoomed, setZoomed] = useState(false);

  return (
    <section id="avalon-os" className="py-6 md:py-16 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-[1fr_1.05fr] gap-3 md:gap-10 items-start">
          {/* LEFT */}
          <div className="min-w-0">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, ease: EASE }}
              className="text-[11px] md:text-sm tracking-[0.28em] text-accent font-body uppercase mb-3 md:mb-4"
            >
              <span className="inline-flex items-center gap-1.5 align-middle"><Smartphone className="w-3 h-3 md:w-3.5 md:h-3.5 inline-block" strokeWidth={1.7} />Avalon OS · Mobile · Coming Soon</span>
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
              className="font-heading text-[9vw] md:text-6xl lg:text-7xl text-foreground tracking-wide leading-[0.9] uppercase"
            >
              From Delivery<br />To Intelligence<span className="text-accent">.</span>
            </motion.h2>
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="w-9 md:w-14 h-[2px] md:h-[3px] bg-accent origin-left mt-3 md:mt-5 mb-4 md:mb-6"
            />

            

            {/* 5 layers with one-line description */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
              className="border border-foreground/15 rounded-md md:rounded-xl divide-y divide-border/40"
            >
              {LAYERS.map((l) => {
                const Icon = l.icon;
                return (
                <div key={l.n} className="flex items-center gap-2 md:gap-3 px-2.5 md:px-4 py-2.5 md:py-3">
                  <span className="text-[11px] md:text-[12px] tracking-[0.25em] text-accent font-body uppercase w-5 md:w-7 shrink-0">L{l.n}</span>
                  {Icon && (
                    <div className="w-7 h-7 md:w-9 md:h-9 rounded-full border border-accent/50 flex items-center justify-center text-accent shrink-0">
                      <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={1.6} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-[14px] md:text-lg text-foreground tracking-wide uppercase leading-none">{l.name}</p>
                    <p className="font-body text-[10px] md:text-[12px] text-muted-foreground leading-snug mt-1">{l.desc}{l.accentTail && <> <span className="text-accent font-normal">{l.accentTail}</span></>}</p>
                  </div>
                  <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-accent/60 shrink-0" strokeWidth={1.6} />
                </div>
                );
              })}
            </motion.div>
          </div>

          {/* RIGHT: phone — entire wrapper is the zoom button */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.9, ease: EASE }}
            className="flex flex-col items-center justify-start min-w-0 gap-2"
          >
            <button
              type="button"
              onClick={() => setZoomed(true)}
              aria-label="Zoom phone preview"
              className="block w-full focus:outline-none cursor-zoom-in active:scale-[0.98] transition-transform"
              style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <PhoneMockup />
            </button>
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="text-[9px] md:text-[10px] tracking-[0.25em] text-accent/80 hover:text-accent uppercase font-body inline-flex items-center gap-1"
            >
              <ZoomIn className="w-2.5 h-2.5 md:w-3 md:h-3" strokeWidth={1.6} />
              Tap to Zoom
            </button>
          </motion.div>
        </div>
      </div>

      {/* ZOOM MODAL */}
      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setZoomed(false)}
          >
            <button
              onClick={() => setZoomed(false)}
              aria-label="Close"
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white border border-white/20 z-[201]"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
            >
              <PhoneMockup large />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
