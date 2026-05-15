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

function ChannelRow({ channel, isLast, index }) {
  const [open, setOpen] = useState(false);
  const { icon: Icon, label, detail, href, cta } = channel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, filter: 'blur(4px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.7, delay: index * 0.11, ease: EASE }}
      className={`${isLast ? '' : 'border-b border-white/[0.06]'}`}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-1 py-4 hover:opacity-80 transition-opacity text-left"
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
            <div className="pb-4 pl-8">
              <p className="font-body text-sm text-foreground/60 leading-relaxed mb-3">{detail}</p>
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
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mb-8 md:mb-10"
        >
          <p className="font-body text-[11px] tracking-[0.3em] uppercase text-accent mb-2">
            Also Available
          </p>
          <h2 className="font-heading text-[9vw] md:text-7xl lg:text-8xl text-foreground uppercase tracking-tight leading-[0.92]">
            More Ways to Book
          </h2>
          <div className="w-10 h-[2px] bg-accent mt-3" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.08 }}
          className="rounded-2xl border border-foreground/10 bg-white/[0.03] backdrop-blur-sm px-5 py-1"
        >
          {CHANNELS.map((channel, i) => (
            <ChannelRow
              key={channel.href}
              channel={channel}
              isLast={i === CHANNELS.length - 1}
              index={i}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
