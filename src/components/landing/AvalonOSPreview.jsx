import React from 'react';
import { motion } from 'framer-motion';
import { Check, Droplet, Pill, Syringe, Dumbbell, Moon, ChevronRight, Wifi } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const LAYERS = [
  { n: 5, name: 'Autonomy' },
  { n: 4, name: 'Intelligence' },
  { n: 3, name: 'Data' },
  { n: 2, name: 'Modalities' },
  { n: 1, name: 'Delivery' },
];

const METRICS = [
  { label: 'HRV', value: '92', type: 'line', color: '#4ade80' },
  { label: 'SLEEP', value: '7h 48m', type: 'bars', color: '#a78bfa' },
  { label: 'RECOVERY', value: '94%', type: 'line', color: '#60a5fa' },
  { label: 'STRAIN', value: '83', type: 'line', color: '#fb923c' },
];

const PROTOCOL = [
  { time: '8:00', name: 'Hydration', detail: '500ml water', icon: Droplet, ring: 'border-green-400/40 text-green-400', done: true },
  { time: '8:30', name: 'NMN', detail: '500mg', icon: Pill, ring: 'border-amber-400/40 text-amber-400', done: true },
  { time: '10:00', name: 'BPC Injection', detail: '250mcg', icon: Syringe, ring: 'border-purple-400/40 text-purple-400', done: true },
  { time: '1:00', name: 'Training', detail: 'Strength', icon: Dumbbell, ring: 'border-amber-500/40 text-amber-500', done: true },
  { time: '6:00', name: 'NAD+ IV', detail: 'Clinic', icon: Droplet, ring: 'border-blue-400/40 text-blue-400', done: false },
  { time: '9:00', name: 'Recovery', detail: 'Magnesium', icon: Moon, ring: 'border-purple-400/40 text-purple-400', done: true },
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

function ComplianceRing({ percent }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  return (
    <div className="relative w-7 h-7 md:w-10 md:h-10">
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke="#4ade80" strokeWidth="2.5" strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-[6px] md:text-[10px] font-bold text-white leading-none">{percent}%</p>
      </div>
    </div>
  );
}

function Sparkline({ color, type }) {
  if (type === 'bars') {
    return (
      <svg viewBox="0 0 40 12" className="w-full h-1.5 md:h-3 mt-0.5" preserveAspectRatio="none">
        {[2, 5, 3, 6, 4, 7, 5, 8, 4, 6].map((h, i) => (
          <rect key={i} x={i * 4} y={12 - h} width="2.5" height={h} fill={color} opacity="0.7" />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 40 12" className="w-full h-1.5 md:h-3 mt-0.5" preserveAspectRatio="none">
      <polyline points="0,8 6,6 12,9 18,5 24,7 30,3 36,5 40,2" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhoneMockup() {
  return (
    <div className="relative w-full max-w-[140px] sm:max-w-[180px] md:max-w-[260px] mx-auto">
      <div className="rounded-[1.2rem] md:rounded-[2rem] border border-foreground/30 bg-black p-1 md:p-1.5 shadow-2xl">
        <div className="rounded-[1rem] md:rounded-[1.7rem] bg-black overflow-hidden relative" style={{ aspectRatio: '9/19.5' }}>
          <div className="flex items-center justify-between px-2.5 md:px-4 pt-1.5 md:pt-2 pb-1">
            <span className="text-[6px] md:text-[10px] font-medium text-white">9:41</span>
            <div className="flex items-center gap-0.5 text-white">
              <Wifi className="w-1.5 h-1.5 md:w-2.5 md:h-2.5" strokeWidth={2.5} />
              <div className="w-2 h-1 md:w-3 md:h-1.5 border border-white rounded-sm relative">
                <div className="absolute inset-0.5 bg-white rounded-[1px]" />
              </div>
            </div>
          </div>
          <div className="px-1.5 md:px-3 pt-0.5 md:pt-1 flex items-start justify-between">
            <div>
              <p className="text-[4px] md:text-[7px] tracking-[0.3em] text-white/60 uppercase">Today</p>
              <p className="font-heading text-[9px] md:text-lg text-white tracking-wide leading-none mt-0.5">APR 24</p>
            </div>
            <ComplianceRing percent={98} />
          </div>
          <div className="mx-1.5 md:mx-3 mt-1 md:mt-2 grid grid-cols-4 gap-0.5 md:gap-1 p-0.5 md:p-1.5 bg-white/5 rounded md:rounded-lg border border-white/10">
            {METRICS.map((m) => (
              <div key={m.label} className="text-center min-w-0">
                <p className="text-[3.5px] md:text-[6px] tracking-widest text-white/50 uppercase truncate">{m.label}</p>
                <p className="text-[5px] md:text-[8px] font-semibold text-white truncate">{m.value}</p>
                <Sparkline color={m.color} type={m.type} />
              </div>
            ))}
          </div>
          <div className="px-1.5 md:px-3 mt-1 md:mt-2">
            <p className="text-[4px] md:text-[7px] tracking-[0.3em] text-accent uppercase mb-0.5 md:mb-1.5">Today's Protocol</p>
            <div className="space-y-0.5 md:space-y-1">
              {PROTOCOL.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.time} className="flex items-center gap-1">
                    <p className="text-[3.5px] md:text-[6px] text-white/60 w-4 md:w-7 shrink-0">{p.time}</p>
                    <div className={`w-3 h-3 md:w-4.5 md:h-4.5 rounded-full border flex items-center justify-center shrink-0 ${p.ring}`}>
                      <Icon className="w-1.5 h-1.5 md:w-2.5 md:h-2.5" strokeWidth={1.6} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[5px] md:text-[8px] font-medium text-white leading-tight truncate">{p.name}</p>
                      <p className="text-[3.5px] md:text-[6px] text-white/50 leading-tight truncate">{p.detail}</p>
                    </div>
                    <div className={`w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full border flex items-center justify-center shrink-0 ${p.done ? 'border-green-400 text-green-400' : 'border-white/30'}`}>
                      {p.done && <Check className="w-1 h-1 md:w-1.5 md:h-1.5" strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mx-1.5 md:mx-3 mt-1 md:mt-2 mb-5 md:mb-7 p-1 md:p-1.5 bg-white/5 rounded md:rounded-lg border border-white/10 relative overflow-hidden">
            <p className="text-[3.5px] md:text-[6px] tracking-[0.3em] text-white/50 uppercase">Next Up</p>
            <p className="font-heading text-[7px] md:text-[11px] text-white tracking-wide leading-none mt-0.5">NAD+ IV</p>
            <p className="text-[3.5px] md:text-[6px] text-white/60 mt-0.5">Scheduled · 6:00 PM</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 px-1 md:px-2 py-0.5 md:py-1 flex justify-between items-center bg-black">
            {['HOME', 'PROTOCOL', 'COACH', 'REPORTS', 'YOU'].map((t, i) => (
              <p key={t} className={`text-[3px] md:text-[5px] tracking-[0.15em] ${i === 0 ? 'text-accent' : 'text-white/40'}`}>{t}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AvalonOSPreview() {
  return (
    <section id="avalon-os" className="py-6 md:py-16 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-[1.15fr_1fr] gap-3 md:gap-10 items-center">
          {/* LEFT */}
          <div className="min-w-0">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, ease: EASE }}
              className="text-[7px] md:text-xs tracking-[0.3em] text-accent font-body uppercase mb-1 md:mb-3"
            >
              Avalon OS · Mobile
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
              className="font-heading text-[5.5vw] md:text-5xl lg:text-6xl text-foreground tracking-wide leading-[0.95] uppercase"
            >
              From Delivery<br />To Intelligence<span className="text-accent">.</span>
            </motion.h2>
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              whileInView={{ opacity: 1, scaleX: 1 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
              className="w-6 md:w-12 h-[2px] md:h-[3px] bg-accent origin-left mt-1.5 md:mt-4 mb-2 md:mb-5"
            />

            {/* 5 layers compact */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
              className="border border-foreground/15 rounded md:rounded-xl divide-y divide-border/40 mb-2 md:mb-4"
            >
              {LAYERS.map((l) => (
                <div key={l.n} className="flex items-center gap-1.5 md:gap-3 px-1.5 md:px-3.5 py-0.5 md:py-2">
                  <span className="text-[6px] md:text-[10px] tracking-[0.25em] text-accent font-body uppercase w-4 md:w-7 shrink-0">L{l.n}</span>
                  <span className="font-heading text-[8px] md:text-sm text-foreground tracking-wide uppercase leading-none flex-1 truncate">{l.name}</span>
                  <ChevronRight className="w-2 h-2 md:w-3.5 md:h-3.5 text-accent/60 shrink-0" strokeWidth={1.6} />
                </div>
              ))}
            </motion.div>

            {/* iOS / Android Coming Soon */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.55, delay: 0.35, ease: EASE }}
              className="border border-foreground/15 rounded md:rounded-xl px-1.5 md:px-3.5 py-1 md:py-2.5 flex items-center gap-1 md:gap-2.5"
            >
              <AppleIcon className="w-2.5 h-2.5 md:w-4 md:h-4 text-accent shrink-0" />
              <AndroidIcon className="w-2.5 h-2.5 md:w-4 md:h-4 text-accent shrink-0" />
              <p className="flex-1 font-body text-[5px] md:text-[10px] tracking-[0.2em] text-foreground/85 uppercase leading-tight truncate">
                Coming Soon · iOS &amp; Android
              </p>
              <ChevronRight className="w-2.5 h-2.5 md:w-4 md:h-4 text-accent shrink-0" strokeWidth={1.6} />
            </motion.div>
          </div>

          {/* RIGHT: phone */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.9, ease: EASE }}
            className="flex justify-center min-w-0"
          >
            <PhoneMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
