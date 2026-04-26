import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Droplet, Pill, Syringe, Dumbbell, Moon, ChevronRight, Wifi, Salad, Sun, X, ZoomIn,
  Truck, BarChart3, Brain, Orbit, Heart, Wind, Activity, Thermometer, ShieldCheck, Home as HomeIcon,
  Calendar, BarChart3 as Chart, User
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
  { label: 'HRV', value: '92', type: 'line', color: '#4ade80' },
  { label: 'SLEEP', value: '7h 48m', type: 'bars', color: '#a78bfa' },
  { label: 'RECOVERY', value: '94%', type: 'line', color: '#60a5fa' },
  { label: 'STRAIN', value: '83', type: 'line', color: '#fb923c' },
];

const VITALS = [
  { label: 'BPM', value: '62', icon: Heart, color: 'text-red-400' },
  { label: 'BRPM', value: '14', icon: Wind, color: 'text-blue-400' },
  { label: 'HRV', value: '88', icon: Activity, color: 'text-green-400' },
  { label: 'TEMP', value: '98.1°', icon: Thermometer, color: 'text-orange-400' },
  { label: 'HYDRATION', value: '72%', icon: Droplet, color: 'text-cyan-400' },
];

const PROTOCOL = [
  { time: '7:00 AM',  name: 'Hydration',              detail: 'Electrolyte water · 500ml',   icon: Droplet,   ring: 'border-green-400/40 text-green-400',     dot: 'bg-green-400',   done: true  },
  { time: '7:30 AM',  name: 'Vitamin Stack',          detail: 'Multi · D3 · Omega-3',         icon: Pill,      ring: 'border-orange-400/40 text-orange-400',   dot: 'bg-orange-400',  done: true  },
  { time: '8:00 AM',  name: 'Sun exposure',           detail: '12 min',                       icon: Sun,       ring: 'border-orange-400/40 text-orange-400',   dot: 'bg-orange-400',  done: true  },
  { time: '8:30 AM',  name: 'High protein breakfast', detail: 'Protein 40g · greens',         icon: Utensils,  ring: 'border-green-400/40 text-green-400',     dot: 'bg-green-400',   done: true  },
  { time: '9:00 AM',  name: 'NAD IV+',                detail: '',                             icon: Droplet,   ring: 'border-blue-400/40 text-blue-400',       dot: 'bg-blue-400',    done: true  },
  { time: '9:00 AM',  name: 'Red light therapy',      detail: '',                             icon: Sun,       ring: 'border-purple-400/40 text-purple-400',   dot: 'bg-purple-400',  done: true  },
  { time: '10:30 AM', name: 'Training',               detail: '',                             icon: Dumbbell,  ring: 'border-purple-400/40 text-purple-400',   dot: 'bg-purple-400',  done: true  },
];

const TABS = [
  { name: 'HOME', icon: HomeIcon, active: true },
  { name: 'PROTOCOL', icon: Calendar, active: false },
  { name: 'COACH', icon: Activity, active: false },
  { name: 'REPORTS', icon: Chart, active: false },
  { name: 'YOU', icon: User, active: false },
];

function ComplianceRing({ percent, size = 'sm' }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const dash = (percent / 100) * c;
  const sizeClass = size === 'lg' ? 'w-14 h-14' : 'w-7 h-7 md:w-10 md:h-10';
  const txtClass = size === 'lg' ? 'text-xs' : 'text-[6px] md:text-[9px]';
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
  const h = large ? 'h-4' : 'h-1.5 md:h-2.5';
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
  const wrapMax = large ? 'max-w-[320px]' : 'max-w-[200px] sm:max-w-[230px] md:max-w-[340px]';
  const radius = large ? 'rounded-[2.4rem]' : 'rounded-[1.4rem] md:rounded-[2rem]';
  const innerRadius = large ? 'rounded-[2rem]' : 'rounded-[1.2rem] md:rounded-[1.7rem]';
  return (
    <div className={`relative w-full ${wrapMax} mx-auto`}>
      <div className={`${radius} border border-foreground/30 bg-black p-1 md:p-1.5 shadow-2xl`}>
        <div className={`${innerRadius} bg-white overflow-hidden relative`} style={{ aspectRatio: '9/19.5' }}>
          {/* Status bar */}
          <div className={`flex items-center justify-between ${large ? 'px-5' : 'px-2.5 md:px-4'} pt-1.5 pb-1`}>
            <span className={large ? 'text-xs' : 'text-[7px] md:text-[10px]'}>9:41</span>
            <div className="flex items-center gap-0.5 text-black">
              <Wifi className={large ? 'w-3.5 h-3.5' : 'w-2 h-2 md:w-3 md:h-3'} strokeWidth={2.5} />
              <div className={large ? 'w-5 h-2.5 border border-black rounded-sm relative' : 'w-2.5 h-1 md:w-3.5 md:h-1.5 border border-black rounded-sm relative'}>
                <div className="absolute inset-0.5 bg-black rounded-[1px]" />
              </div>
            </div>
          </div>
          {/* Header */}
          <div className={`${large ? 'px-5' : 'px-2 md:px-3.5'} pt-1 grid grid-cols-3 items-center gap-0.5`}>
            <div className="text-left min-w-0">
              <p className={`${large ? 'text-[9px]' : 'text-[5px] md:text-[7px]'} tracking-[0.3em] text-black/60 uppercase leading-none`}>Today</p>
              <p className={`font-heading ${large ? 'text-xl' : 'text-[10px] md:text-base'} text-black tracking-wide leading-none mt-0.5`}>APR 24</p>
              <p className={`${large ? 'text-[8px]' : 'text-[4.5px] md:text-[6px]'} tracking-[0.25em] text-black/50 uppercase leading-none mt-0.5`}>Thursday</p>
            </div>
            <div className="flex flex-col items-center justify-center">
              <Droplet className={large ? 'w-4 h-4 text-accent mb-0.5' : 'w-2 h-2 md:w-3 md:h-3 text-accent'} strokeWidth={1.5} />
              <p className={`font-heading ${large ? 'text-sm' : 'text-[7px] md:text-[10px]'} text-black tracking-[0.18em] leading-none mt-0.5`}>
                AVALON <span className="text-accent">OS</span>
              </p>
            </div>
            <div className="flex justify-end">
              <ComplianceRing percent={98} size={large ? 'lg' : 'sm'} />
            </div>
          </div>
          {/* Metric tiles */}
          <div className={`mx-2 md:mx-3.5 mt-1 md:mt-2 grid grid-cols-4 gap-0.5 md:gap-1 p-1 md:p-1.5 bg-black/5 rounded md:rounded-lg border border-black/10`}>
            {METRICS.map((m) => (
              <div key={m.label} className="text-center min-w-0">
                <p className={`${large ? 'text-[8px]' : 'text-[5px] md:text-[7px]'} tracking-widest text-black/50 uppercase truncate`}>{m.label}</p>
                <p className={`${large ? 'text-[12px]' : 'text-[6.5px] md:text-[9px]'} font-semibold text-black truncate`}>{m.value}</p>
                <Sparkline color={m.color} type={m.type} large={large} />
              </div>
            ))}
          </div>
          {/* Live Vitals */}
          <div className={`mx-2 md:mx-3.5 mt-1 md:mt-1.5 p-1 md:p-1.5 bg-black/5 rounded md:rounded-lg border border-black/10`}>
            <div className="flex items-center justify-between mb-0.5 md:mb-1">
              <p className={`${large ? 'text-[9px]' : 'text-[6.5px] md:text-[9px]'} tracking-[0.25em] text-accent uppercase font-semibold`}>Live Vitals</p>
              <p className={`${large ? 'text-[7px]' : 'text-[3.5px] md:text-[5px]'} tracking-[0.15em] text-black/50 uppercase flex items-center gap-1`}>
                <span className="hidden md:inline">Apple Watch + WHOOP</span>
                <span className="md:hidden">AW · WHOOP</span>
                <span className="w-1 h-1 rounded-full bg-green-400 inline-block animate-pulse" />
              </p>
            </div>
            <div className="grid grid-cols-5 gap-0.5">
              {VITALS.map((v) => {
                const Icon = v.icon;
                return (
                  <div key={v.label} className="flex flex-col items-center text-center min-w-0">
                    <Icon className={`${large ? 'w-3 h-3' : 'w-1.5 h-1.5 md:w-2.5 md:h-2.5'} ${v.color} shrink-0`} strokeWidth={1.8} />
                    <p className={`${large ? 'text-[10px]' : 'text-[6.5px] md:text-[9px]'} font-semibold text-black leading-tight truncate w-full`}>{v.value}</p>
                    <p className={`${large ? 'text-[6px]' : 'text-[3px] md:text-[4.5px]'} tracking-widest text-black/50 uppercase leading-tight truncate w-full`}>{v.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Morning Protocol */}
          <div className={`${large ? 'px-5' : 'px-2 md:px-3.5'} mt-1 md:mt-2`}>
            <p className={`${large ? 'text-[10px]' : 'text-[6.5px] md:text-[9px]'} tracking-[0.3em] text-accent uppercase mb-0.5 md:mb-1 font-semibold`}>Morning Protocol</p>
            <div className="relative">
              <div className={`absolute top-1 bottom-1 ${large ? 'left-[58px]' : 'left-[20px] md:left-[34px]'} w-px bg-white/10`} />
              <div className={`${large ? 'space-y-1.5' : 'space-y-0.5 md:space-y-1'}`}>
                {PROTOCOL.map((p) => {
                  const Icon = p.icon;
                  return (
                    <div key={p.time + p.name} className="flex items-center gap-1 relative">
                      <p className={`${large ? 'text-[9px] w-12' : 'text-[5px] md:text-[7px] w-5 md:w-8'} text-black/60 shrink-0`}>{p.time}</p>
                      <div className={`${large ? 'w-2 h-2' : 'w-0.5 h-0.5 md:w-1 md:h-1'} rounded-full ${p.dot} shrink-0 z-10`} />
                      <div className={`${large ? 'w-7 h-7' : 'w-3 h-3 md:w-4 md:h-4'} rounded-full border flex items-center justify-center shrink-0 ${p.ring} bg-black`}>
                        <Icon className={large ? 'w-3.5 h-3.5' : 'w-1.5 h-1.5 md:w-2 md:h-2'} strokeWidth={1.6} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`${large ? 'text-[12px]' : 'text-[5.5px] md:text-[8.5px]'} font-medium text-black leading-tight truncate`}>{p.name}</p>
                        <p className={`${large ? 'text-[10px]' : 'text-[5px] md:text-[7px]'} text-black/50 leading-tight truncate`}>{p.detail}</p>
                      </div>
                      <div className={`${large ? 'w-4 h-4' : 'w-1.5 h-1.5 md:w-2.5 md:h-2.5'} rounded-full border flex items-center justify-center shrink-0 ${p.done ? 'border-green-400 text-green-400' : 'border-black/30'}`}>
                        {p.done && <Check className={large ? 'w-2.5 h-2.5' : 'w-1 h-1 md:w-1.5 md:h-1.5'} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Tab bar */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-black/10 px-1.5 md:px-2.5 py-0.5 md:py-1 flex justify-between items-end bg-white">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.name} className="flex flex-col items-center gap-0.5">
                  <Icon className={`${large ? 'w-3.5 h-3.5' : 'w-2 h-2 md:w-3 md:h-3'} ${t.active ? 'text-accent' : 'text-black/40'}`} strokeWidth={1.7} />
                  <p className={`${large ? 'text-[7px]' : 'text-[3px] md:text-[5px]'} tracking-[0.15em] ${t.active ? 'text-accent' : 'text-black/40'}`}>{t.name}</p>
                  {t.active && <div className={`${large ? 'w-3 h-[2px]' : 'w-1 h-px md:w-2 md:h-[1.5px]'} bg-accent rounded-full`} />}
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
    <section id="avalon-os" className="py-10 md:py-20 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        {/* HEADER — full width, matches other section title cards */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-left mb-7 md:mb-12"
        >
          <p className="text-sm md:text-base tracking-[0.3em] text-accent font-body uppercase mb-4 md:mb-5">Coming Soon</p>
          <h2 className="font-heading text-foreground tracking-wide leading-[0.92] uppercase text-[10vw] md:text-7xl lg:text-8xl">
            Avalon OS
          </h2>
          <div className="w-10 md:w-14 h-[2px] md:h-[3px] bg-accent mt-3 md:mt-5 mb-3 md:mb-4" />
          <p className="font-heading text-xl md:text-2xl lg:text-3xl text-foreground/85 tracking-wide uppercase leading-tight">
            Intelligent Delivery
          </p>
        </motion.div>

        <div className="grid grid-cols-[1fr_1.05fr] md:grid-cols-2 gap-3 md:gap-10 items-center">
          {/* LEFT — layers + trust */}
          <div className="min-w-0">

            {/* 5 layers — compact, name only on mobile */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
              className="border border-foreground/15 rounded md:rounded-xl divide-y divide-border/40 mb-2 md:mb-3"
            >
              {LAYERS.map((l) => {
                const Icon = l.icon;
                return (
                  <div key={l.n} className="flex items-start gap-2.5 md:gap-3 px-3 md:px-4 py-3 md:py-3.5">
                    <span className="text-[13px] md:text-[14px] tracking-[0.2em] text-accent font-body uppercase w-5 md:w-6 shrink-0 pt-0.5">{l.n}</span>
                    <div className="w-9 h-9 md:w-11 md:h-11 rounded-full border border-accent/55 flex items-center justify-center text-accent shrink-0">
                      <Icon className="w-4 h-4 md:w-5 md:h-5" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading text-[14px] md:text-base text-foreground tracking-wide uppercase leading-none mb-1">{l.name}</p>
                      <p className="font-body text-[11px] md:text-[13px] text-muted-foreground leading-snug">
                        {l.desc}{l.accentTail && <> <span className="text-accent font-normal">{l.accentTail}</span></>}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 text-accent/60 shrink-0" strokeWidth={1.6} />
                  </div>
                );
              })}
            </motion.div>

            {/* Trust card — single line */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10%' }}
              transition={{ duration: 0.55, delay: 0.4, ease: EASE }}
              className="border border-foreground/15 rounded-md md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 flex items-center gap-2.5 md:gap-3"
            >
              <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-accent shrink-0" strokeWidth={1.5} />
              <p className="font-body text-[11px] md:text-xs tracking-[0.15em] text-foreground/85 uppercase leading-tight truncate flex-1">
                HIPAA · ISO 27001 · SOC 2
              </p>
            </motion.div>
          </div>

          {/* RIGHT — phone */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-10%' }}
            transition={{ duration: 0.9, ease: EASE }}
            className="flex flex-col items-center justify-center gap-1.5 min-w-0"
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
              className="text-[11px] md:text-xs tracking-[0.25em] text-accent/80 hover:text-accent uppercase font-body inline-flex items-center gap-1"
            >
              <ZoomIn className="w-3 h-3 md:w-3.5 md:h-3.5" strokeWidth={1.6} />
              Tap to Zoom
            </button>
          </motion.div>
        </div>
      </div>

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
