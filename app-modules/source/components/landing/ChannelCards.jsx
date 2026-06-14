import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Building2, Calendar, Sparkles, ChevronDown, ArrowRight } from 'lucide-react';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

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
      className={`av-treatment-card relative overflow-hidden rounded-[1.55rem] border transition-colors duration-base ease-editorial ${open ? 'is-open' : ''}`}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="w-full flex items-center gap-4 px-5 py-4 transition-colors duration-base ease-editorial text-left"
        aria-expanded={open}
      >
        <span className="av-treatment-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">
          <Icon className="w-4 h-4 text-accent" strokeWidth={1.5} />
        </span>
        <span className="font-heading text-lg uppercase text-foreground/66 flex-1">{label}</span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="text-foreground/40 shrink-0"
        >
          <ChevronDown className="w-4 h-4" strokeWidth={2} />
        </motion.div>
      </motion.button>

      <SmoothDisclosure open={open}>
        <div className="px-5 pb-5 pt-0 border-t border-foreground/[0.07]">
          <p className="font-body text-sm text-foreground/60 leading-relaxed mb-3 mt-4">{detail}</p>
          <Link
            to={href}
            className="group inline-flex items-center gap-1.5 font-body text-[11px] tracking-[0.15em] uppercase text-foreground/66 hover:text-foreground transition-colors duration-base ease-editorial"
          >
            {cta}
            <ArrowRight className="w-3 h-3 transition-transform duration-base ease-editorial group-hover:translate-x-1" strokeWidth={2} />
          </Link>
        </div>
      </SmoothDisclosure>
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
