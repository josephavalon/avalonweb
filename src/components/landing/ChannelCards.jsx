import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Calendar, Sparkles, ChevronDown, ArrowRight } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const CHANNELS = [
  { icon: Building2, label: 'Corporate Teams',      detail: 'Volume pricing and office wellness programs. Request a proposal — we come to you.', href: '/corporate', cta: 'Request a Proposal' },
  { icon: Calendar,  label: 'Events & Activations', detail: 'IV therapy activations for conferences, retreats, music events, and private experiences.', href: '/events', cta: 'Book an Activation' },
  { icon: Sparkles,  label: 'VIPs',                 detail: 'Pre- and post-performance recovery protocols for performers, competitors, and high-output individuals.', href: '/athlete', cta: 'View Protocols' },
];

function ChannelRow({ channel, index }) {
  const [open, setOpen] = useState(false);
  const { icon: Icon, label, detail, href, cta } = channel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96, filter: 'blur(4px)' }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.95, delay: index * 0.1, ease: EASE }}
      className="rounded-2xl border border-foreground/10 bg-white/[0.08] backdrop-blur-xl overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-5 [@media(hover:hover)]:hover:bg-white/[0.08] transition-colors text-left"
        aria-expanded={open}
      >
        <Icon className="w-4 h-4 text-accent shrink-0" strokeWidth={1.5} />
        <span className="font-heading text-lg uppercase text-foreground flex-1">{label}</span>
        <ChevronDown
          className="w-4 h-4 text-foreground/40 transition-transform duration-300 shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-5 pb-5 pt-0 border-t border-foreground/[0.06]">
              <p className="font-body text-sm text-foreground/60 leading-relaxed mb-3 mt-4">{detail}</p>
              <Link
                to={href}
                className="inline-flex items-center gap-1.5 font-body text-[11px] tracking-[0.15em] uppercase text-accent hover:text-accent/80 transition-colors"
              >
                {cta}
                <ArrowRight className="w-3 h-3" strokeWidth={2} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ChannelCards() {
  return (
    <section
      aria-label="Additional booking channels"
      className="pt-4 pb-8 md:pt-6 md:pb-10 px-4"
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
        </motion.div>

        <div className="flex flex-col gap-3">
          {CHANNELS.map((channel, i) => (
            <ChannelRow
              key={channel.href}
              channel={channel}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
