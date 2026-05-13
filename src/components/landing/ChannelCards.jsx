import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Calendar } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

const CHANNELS = [
  {
    icon: Building2,
    headline: 'For Teams',
    sub: 'Corporate wellness. Volume pricing. Bring Avalon to your office.',
    cta: 'Request a Proposal →',
    href: '/corporate',
  },
  {
    icon: Calendar,
    headline: 'For Events',
    sub: 'IV therapy activations for conferences, retreats, and private events.',
    cta: 'Book an Activation →',
    href: '/events',
  },
];

function ChannelCard({ channel, index }) {
  const { icon: Icon, headline, sub, cta, href } = channel;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: EASE, delay: index * 0.08 }}
    >
      <Link
        to={href}
        className="block rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-4 md:p-6 hover:bg-foreground/[0.06] hover:border-foreground/[0.15] transition-all duration-300 group h-full"
      >
        <Icon
          className="w-8 h-8 text-accent mb-4"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <h3 className="font-heading text-3xl text-foreground uppercase mb-2">
          {headline}
        </h3>
        <p className="font-body text-sm text-foreground/60 leading-relaxed mb-4">
          {sub}
        </p>
        <span className="font-body text-[11px] tracking-[0.2em] uppercase text-foreground/50 group-hover:text-foreground transition-colors">
          {cta}
        </span>
      </Link>
    </motion.div>
  );
}

export default function ChannelCards() {
  return (
    <section
      aria-label="Additional booking channels"
      className="py-16 md:py-20 px-5 md:px-12 lg:px-20"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: EASE }}
        className="mb-8 md:mb-10"
      >
        <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
          Also Available
        </p>
        <h2 className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-none">
          More Ways to Book
        </h2>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 md:gap-5">
        {CHANNELS.map((channel, i) => (
          <ChannelCard key={channel.href} channel={channel} index={i} />
        ))}
      </div>
    </section>
  );
}
