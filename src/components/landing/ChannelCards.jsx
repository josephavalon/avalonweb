import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Calendar, Sparkles, ChevronDown, ArrowRight } from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';

const CHANNELS = [
  { icon: Building2, label: 'Corporate Teams',      detail: 'Volume pricing and office wellness programs. Request a proposal — we come to you.', href: '/corporate', cta: 'Request a Proposal' },
  { icon: Calendar,  label: 'Launches', detail: 'Recovery activations for conferences, retreats, music launches, and private experiences.', href: '/launches', cta: 'Plan a Launch' },
  { icon: Sparkles,  label: 'VIPs',                 detail: 'Pre- and post-performance recovery protocols for performers, competitors, and high-output individuals.', href: '/athlete', cta: 'View Protocols' },
];

function ChannelRow({ channel, index, open, onToggle }) {
  const { icon: Icon, label, detail, href, cta } = channel;

  return (
    <motion.div
      whileHover={premiumHover}
      className={`rounded-2xl border shadow-[0_18px_70px_hsl(var(--foreground)/0.035)] transition-colors duration-base ease-editorial ${
        open
          ? 'border-accent/35 bg-white/[0.12]'
          : 'border-foreground/10 bg-white/[0.08] hover:border-foreground/20 hover:bg-white/[0.105]'
      }`}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="w-full flex items-center gap-4 px-5 py-5 [@media(hover:hover)]:hover:bg-white/[0.08] transition-colors duration-base ease-editorial text-left"
        aria-expanded={open}
      >
        <Icon className="w-4 h-4 text-accent shrink-0" strokeWidth={1.5} />
        <span className="font-heading text-lg uppercase text-foreground flex-1">{label}</span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="text-foreground/40 shrink-0"
        >
          <ChevronDown className="w-4 h-4" strokeWidth={2} />
        </motion.div>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.42, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 pt-0 border-t border-foreground/[0.06]">
              <p className="font-body text-sm text-foreground/60 leading-relaxed mb-3 mt-4">{detail}</p>
              <Link
                to={href}
                className="group inline-flex items-center gap-1.5 font-body text-[11px] tracking-[0.15em] uppercase text-accent hover:text-accent/80 transition-colors duration-base ease-editorial"
              >
                {cta}
                <ArrowRight className="w-3 h-3 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ChannelCards() {
  const [openChannel, setOpenChannel] = useState(null);

  return (
    <section
      aria-label="Additional booking channels"
      className="pt-10 pb-10 md:pt-16 md:pb-16 px-4"
    >
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.95, ease: EASE }}
          className="mb-8 md:mb-10"
        >
          <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">
            Also Available
          </p>
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">
            More Ways to Book
          </h2>
          <p className="font-body text-sm text-foreground/55 leading-relaxed mt-3 max-w-md">
            Private visits are the core flow. Teams, launches, and VIP protocols get a tailored path.
          </p>
        </motion.div>

        <div className="flex flex-col gap-3">
          {CHANNELS.map((channel, i) => (
            <ChannelRow
              key={channel.href}
              channel={channel}
              index={i}
              open={openChannel === channel.href}
              onToggle={() => setOpenChannel(current => current === channel.href ? null : channel.href)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
