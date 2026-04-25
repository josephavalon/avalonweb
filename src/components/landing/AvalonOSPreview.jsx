import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Droplet, Pill, Syringe, Dumbbell, Moon, ChevronRight, Wifi, Salad, Sun, X, ZoomIn,
  Truck, BarChart3, Brain, Orbit, Heart, Wind, Activity, Thermometer, ShieldCheck, Home as HomeIcon,
  Calendar, BarChart3 as Chart, User, Award
} from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const LAYERS = [
  { n: 1, name: 'Delivery',     desc: 'We ship or come to you.',          icon: Truck },
  { n: 2, name: 'Modalities',   desc: 'IVs, NAD+, peptides, TRT.',        icon: Droplet },
  { n: 3, name: 'Data',         desc: 'Everything tracked, end-to-end.',  icon: BarChart3 },
  { n: 4, name: 'Intelligence', desc: 'We learn what works.',             icon: Brain },
  { n: 5, name: 'Autonomy',     desc: 'Your protocol runs itself.', accentTail: 'Avalon delivers it.', icon: Orbit },
];

const METRICS = [
  { label: 'HRV',      value: '92',     type: 'line', color: '#4ade80' },
  { label: 'SLEEP',    value: '7h 48m', type: 'bars', color: '#a78bfa' },
  { label: 'RECOVERY', value: '94%',    type: 'line', color: '#60a5fa' },
  { label: 'STRAIN',   value: '83',     type: 'line', color: '#fb923c' },
];

const VITALS = [
  { label: 'BPM',       value: '62',    icon: Heart,       color: 'text-red-400' },
  { label: 'BRPM',      value: '14',    icon: Wind,        color: 'text-blue-400' },
  { label: 'HRV',       value: '88',    icon: Activity,    color: 'text-green-400' },
  { label: 'TEMP',      value: '98.1°', icon: Thermometer, color: 'text-orange-400' },
  { label: 'HYDRATION', value: '72%',   icon: Droplet,     color: 'text-cyan-400' },
];

const PROTOCOL = [
  { time: '7:00 AM',  name: 'Hydration',           detail: 'Electrolyte water · 500ml',   icon: Droplet,  ring: 'border-green-400/40 text-green-400',     dot: 'bg-green-400',   done: true  },
  { time: '8:00 AM',  name: 'Vitamin Stack',       detail: 'Multi · D3 · Omega-3',         icon: Pill,     ring: 'border-amber-400/40 text-amber-400',     dot: 'bg-amber-400',   done: true  },
  { time: '8:30 AM',  name: 'NMN',                 detail: '500mg',                        icon: Pill,     ring: 'border-orange-400/40 text-orange-400',   dot: 'bg-orange-400',  done: true  },
  { time: '9:30 AM',  name: 'Diet · Breakfast',    detail: 'Protein 40g · greens',         icon: Salad,    ring: 'border-green-400/40 text-green-400',     dot: 'bg-green-400',   done: true  },
  { time: '10:00 AM', name: 'BPC Injection',       detail: '250mcg',                       icon: Syringe,  ring: 'border-purple-400/40 text-purple-400',   dot: 'bg-purple-400',  done: true  },
  { time: '12:30 PM', name: 'Water',               detail: '1L · electrolytes',            icon: Droplet,  ring: 'border-cyan-400/40 text-cyan-400',       dot: 'bg-cyan-400',    done: true  },
  { time: '1:00 PM',  name: 'Training',            detail: 'Strength',                     icon: Dumbbell, ring: 'border-orange-400/40 text-orange-400',   dot: 'bg-orange-400',  done: true  },
  { time: '6:00 PM',  name: 'NAD+ IV + Red Light', detail: 'Clinic · 30 min',              icon: Sun,      ring: 'border-blue-400/40 text-blue-400',       dot: 'bg-blue-400',    done: false },
  { time: '9:00 PM',  name: 'Recovery',            detail: 'Magnesium · Glycine',          icon: Moon,     ring: 'border-purple-400/40 text-purple-400',   dot: 'bg-purple-400',  done: true  },
];

const TABS = [
  { name: 'HOME',     icon: HomeIcon,   active: true  },
  { name: 'PROTOCOL', icon: Calendar,   active: false },
  { name: 'COACH',    icon: Activity,   active: false },
  { name: 'REPORTS',  icon: Chart,      active: false },
  { name: 'YOU',      icon: User,       active: false },
];

const CERTS = [
  { label: 'HIPAA', sub: 'COMPLIANT', icon: ShieldCheck },
  { label: 'ISO',   sub: '27001',     icon: Award },
  { label: 'SOC 2', sub: 'TYPE II',   icon: ShieldCheck },
];

function ComplianceRing({ percent, size = 'sm' }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  const sizeClass = size === 'lg' ? 'w-14 h-14' : 'w-9 h-9 md:w-11 md:h-11';
  const txtClass = size === 'lg' ? 'text-xs' : 'text-[7px] md:text-[10px]';
  const subClass = size === 'lg' ? 'text-[8px]' : 'text-[5px] md:text-[6px]';
  return (
    <div className={`relative ${sizeClass}`}>
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke="#4ade80" strokeWidth="2.5" strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className={`${txtClass} font-bold text-white leading-none`}>{percent}%</p>
        <p className={`${subClass} tracking-[0.2em] text-white/60 uppercase leading-none mt-0.5`}>Optimal</p>
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
  const wrapMax = large ? 'max-w-[320px]' : 'max-w-[220px] sm:max-w-[280px] md:max-w-[360px]';
  const radius = large ? 'rounded-[2.4rem]' : 'rounded-[1.6rem] md:rounded-[2.3rem]';
  const innerRadius = large ? 'rounded-[2rem]' : 'rounded-[1.4rem] md:rounded-[2rem]';
  const padX = large ? 'px-5' : 'px-3 md:px-4';
  return (
    <div className={`relative w-full ${wrapMax} mx-auto`}>
      <div className={`${radius} border border-foreground/30 bg-black p-1 md:p-1.5 shadow-2xl`}>
        <div className={`${innerRadius} bg-black overflow-hidden relative`} style={{ aspectRatio: '9/19.5' }}>
          {/* Status bar */}
          <div className={`flex items-center justify-between ${padX} pt-2 pb-1`}>
            <span className={large ? 'text-xs' : 'text-[7px] md:text-[10px]'}>9:41</span>
            <div className="flex items-center gap-0.5 text-white">
              <Wifi className={large ? 'w-3.5 h-3.5' : 'w-2 h-2 md:w-3 md:h-3'} strokeWidth={2.5} />
              <div className={large ? 'w-5 h-2.5 border border-white rounded-sm relative' : 'w-2.5 h-1 md:w-3.5 md:h-1.5 border border-white rounded-sm relative'}>
                <div className="absolute inset-0.5 bg-white rounded-[1px]" />
              </div>
            </div>
          </div>

          {/* Header — TODAY/APR 24/THURSDAY | AVALON OS logo | 98% OPTIMAL ring */}
          <div className={`${padX} pt-1 grid grid-cols-3 items-center gap-1`}>
            <div className="text-left">
              <p className={`${large ? 'text-[9px]' : 'text-[5px] md:text-[7px]'} tracking-[0.3em] text-white/60 uppercase leading-none`}>Today</p>
              <p className={`font-heading ${large ? 'text-xl' : 'text-[10px] md:text-base'} text-white tracking-wide leading-none mt-0.5`}>APR 24</p>
              <p className={`${large ? 'text-[8px]' : 'text-[4.5px] md:text-[6px]'} tracking-[0.25em] text-white/50 uppercase leading-none mt-0.5`}>Thursday</p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <Droplet className={large ? 'w-4 h-4 text-accent mb-0.5' : 'w-2 h-2 md:w-3 md:h-3 text-accent mb-0.5'} strokeWidth={1.5} />
              <p className={`font-heading ${large ? 'text-sm' : 'text-[8px] md:text-[11px]'} text-white tracking-[0.18em] leading-none`}>
                AVALON <span className="text-accent">OS</span>
              </p>
            </div>
            <div className="flex justify-end">
              <ComplianceRing percent={98} size={large ? 'lg' : 'sm'} />
            </div>
          </div>

          {/* 4 metric tiles */}
          <div className={`mx-3 md:mx-4 mt-2 grid grid-cols-4 gap-0.5 md:gap-1 p-1 md:p-1.5 bg-white/5 rounded md:rounded-lg border border-white/10`}>
            {METRICS.map((m) => (
              <div key={m.label} className="text-center min-w-0">
                <p className={`${large ? 'text-[8px]' : 'text-[4px] md:text-[6px]'} tracking-widest text-white/50 uppercase truncate`}>{m.label}</p>
                <p className={`${large ? 'text-[12px]' : 'text-[6px] md:text-[9px]'} font-semibold text-white truncate`}>{m.value}</p>
                <Sparkline color={m.color} type={m.type} large={large} />
              </div>
            ))}
          </div>

          {/* LIVE VITALS card */}
          <div className={`mx-3 md:mx-4 mt-1.5 md:mt-2 p-1.5 md:p-2 bg-white/5 rounded md:rounded-lg border border-white/10`}>
            <div className="flex items-center justify-between mb-1">
              <p className={`${large ? 'text-[9px]' : 'text-[5px] md:text-[7px]'} tracking-[0.25em] text-accent uppercase font-semibold`}>Live Vitals</p>
              <p className={`${large ? 'text-[7px]' : 'text-[4px] md:text-[5px]'} tracking-[0.15em] text-white/50 uppercase flex items-center gap-1`}>
                <span>Apple Watch + WHOOP</span>
                <span className="w-1 h-1 rounded-full bg-green-400 inline-block animate-pulse" />
              </p>
            </div>
            <div className="grid grid-cols-5 gap-0.5 md:gap-1">
              {VITALS.map((v) => {
                const Icon = v.icon;
                return (
                  <div key={v.label} className="flex flex-col items-center text-center min-w-0">
                    <Icon className={`${large ? 'w-3 h-3' : 'w-2 h-2 md:w-3 md:h-3'} ${v.color} shrink-0`} strokeWidth={1.8} />
                    <p className={`${large ? 'text-[10px]' : 'text-[5px] md:text-[8px]'} font-semibold text-white leading-tight mt-0.5 truncate w-full`}>{v.value}</p>
                    <p className={`${large ? 'text-[6px]' : 'text-[3px] md:text-[5px]'} tracking-widest text-white/50 uppercase leading-tight truncate w-full`}>{v.label}</p>
                  </div>
                );
              })}
            </div>
            <p className={`${large ? 'text-[7px]' : 'text-[3.5px] md:text-[5px]'} text-white/40 text-center mt-1 tracking-wider uppercase`}>Swipe for more →</p>
          </div>

          {/* Today's Protocol with timeline dots */}
          <div className={`${padX} mt-2`}>
            <p className={`${large ? 'text-[10px]' : 'text-[5px] md:text-[8px]'} tracking-[0.3em] text-accent uppercase mb-1 font-semibold`}>Today's Protocol</p>
            <div className="relative">
              {/* timeline vertical line */}
              <div className={`absolute top-1.5 bottom-1.5 ${large ? 'left-[58px]' : 'left-[26px] md:left-[38px]'} w-px bg-white/10`} />
              <div className={`${large ? 'space-y-1.5' : 'space-y-0.5 md:space-y-1'}`}>
                {PROTOCOL.map((p) => {
                  const Icon = p.icon;
                  return (
                    <div key={p.time + p.name} className="flex items-center gap-1 md:gap-1.5 relative">
                      <p className={`${large ? 'text-[9px] w-12' : 'text-[4.5px] md:text-[7px] w-7 md:w-9'} text-white/60 shrink-0`}>{p.time}</p>
                      <div className={`${large ? 'w-2 h-2' : 'w-1 h-1 md:w-1.5 md:h-1.5'} rounded-full ${p.dot} shrink-0 z-10`} />
                      <div className={`${large ? 'w-7 h-7' : 'w-3.5 h-3.5 md:w-5 md:h-5'} rounded-full border flex items-center justify-center shrink-0 ${p.ring} bg-black`}>
                        <Icon className={large ? 'w-3.5 h-3.5' : 'w-2 h-2 md:w-2.5 md:h-2.5'} strokeWidth={1.6} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`${large ? 'text-[12px]' : 'text-[6px] md:text-[9px]'} font-medium text-white leading-tight truncate`}>{p.name}</p>
                        <p className={`${large ? 'text-[10px]' : 'text-[4.5px] md:text-[7px]'} text-white/50 leading-tight truncate`}>{p.detail}</p>
                      </div>
                      <div className={`${large ? 'w-4 h-4' : 'w-2 h-2 md:w-3 md:h-3'} rounded-full border flex items-center justify-center shrink-0 ${p.done ? 'border-green-400 text-green-400' : 'border-white/30'}`}>
                        {p.done && <Check className={large ? 'w-2.5 h-2.5' : 'w-1 h-1 md:w-1.5 md:h-1.5'} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom tab bar with icons */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 px-1.5 md:px-2.5 py-1 md:py-1.5 flex justify-between items-end bg-black">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.name} className="flex flex-col items-center gap-0.5">
                  <Icon className={`${large ? 'w-3.5 h-3.5' : 'w-2 h-2 md:w-3 md:h-3'} ${t.active ? 'text-accent' : 'text-white/40'}`} strokeWidth={1.7} />
                  <p className={`${large ? 'text-[7px]' : 'text-[3.5px] md:text-[5px]'} tracking-[0.15em] ${t.active ? 'text-accent' : 'text-white/40'}`}>{t.name}</p>
                  {t.active && <div className={`${large ? 'w-3 h-[2px]' : 'w-1.5 h-px md:w-2 md:h-[1.5px]'} bg-accent rounded-full`} />}
                </div>
              );
            })}
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
              className="text-[11px] md:text-sm tracking-[0.28em] text-accent font-body uppercase mb-3 md:mb-4 leading-tight"
            >
              Coming Soon —<br />Avalon OS
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
              className="font-heading text-[10vw] md:text-6xl lg:text-7xl text-foreground tracking-wide leading-[0.9] uppercase"
            >
              From<br />Delivery<br />To<br />Intelligence<span className="text-accent">.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: 0.18, ease: EASE }}
              className="font-body text-[11px] md:text-base text-muted-foreground leading-snug mt-4 md:mt-6 mb-4 md:mb-6"
            >
              Real-time data. Intelligent protocol.<br />Peak every day.
            </motion.p>

            {/* 5 layer cards */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
              className="space-y-2 md:space-y-2.5"
            >
              {LAYERS.map((l) => {
                const Icon = l.icon;
                return (
                  <div key={l.n} className="flex items-center gap-2 md:gap-3 px-2.5 md:px-4 py-2.5 md:py-3 border border-foreground/15 rounded-md md:rounded-xl">
                    <span className="text-[12px] md:text-[14px] tracking-[0.2em] text-accent font-body uppercase w-4 md:w-6 shrink-0">{l.n}</span>
                    <div className="w-9 h-9 md:w-12 md:h-12 rounded-full border border-accent/55 flex items-center justify-center text-accent shrink-0">
                      <Icon className="w-4 h-4 md:w-5 md:h-5" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading text-[12px] md:text-base text-foreground tracking-wide uppercase leading-none mb-1">{l.name}</p>
                      <p className="font-body text-[9px] md:text-xs text-muted-foreground leading-snug">
                        {l.desc}{l.accentTail && <> <span className="text-accent font-normal">{l.accentTail}</span></>}
                      </p>
                    </div>
                    <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-accent/60 shrink-0" strokeWidth={1.6} />
                  </div>
                );
              })}
            </motion.div>

            {/* Trust / Compliance card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
              className="mt-3 md:mt-5 border border-foreground/15 rounded-md md:rounded-xl px-2.5 md:px-4 py-2.5 md:py-3"
            >
              <div className="flex items-start gap-2 md:gap-3 mb-2 md:mb-3">
                <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-accent shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[10px] md:text-sm text-foreground leading-snug">Your health. Your data. Our priority.</p>
                  <p className="font-body text-[8px] md:text-[11px] text-muted-foreground leading-snug mt-0.5">HIPAA-compliant. Bank-level security.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 md:gap-2">
                {CERTS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <div key={c.label} className="flex items-center gap-1 md:gap-1.5 px-1 md:px-1.5 py-1 border border-foreground/10 rounded">
                      <Icon className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-accent/70 shrink-0" strokeWidth={1.5} />
                      <div className="min-w-0 leading-none">
                        <p className="font-body text-[7px] md:text-[10px] text-foreground/85 font-semibold tracking-wide uppercase truncate">{c.label}</p>
                        <p className="font-body text-[5px] md:text-[8px] text-muted-foreground tracking-widest uppercase truncate">{c.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>

          {/* RIGHT: phone */}
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
