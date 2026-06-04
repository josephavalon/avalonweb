import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { EASE } from '@/lib/motion';

const discoverySections = [
  {
    eyebrow: 'Featured',
    cards: [
      {
        title: 'Recovery IV',
        sub: 'Recover faster.',
        href: '/book?protocol=recovery&time=asap',
        image: '/bags/optimized/recovery.png',
        tone: 'object-contain p-10',
      },
      {
        title: 'Founder Membership',
        sub: 'Early access.',
        href: '/subscription',
        image: '/images/avalon-hero-new.jpg',
      },
    ],
  },
  {
    eyebrow: 'Protocols',
    cards: [
      {
        title: "Myers' Cocktail",
        sub: 'Classic wellness.',
        href: '/book?protocol=myers&time=asap',
        image: '/bags/optimized/myers-cocktail-cutout.png',
        tone: 'object-contain p-8',
      },
      {
        title: 'Jet Lag',
        sub: 'Land recovered.',
        href: '/book?protocol=jetlag&time=asap',
        image: '/bags/optimized/jet-lag.png',
        tone: 'object-contain p-10',
      },
      {
        title: 'Hydration',
        sub: 'The essential.',
        href: '/book?protocol=hydration&time=asap',
        image: '/bags/optimized/dehydration.png',
        tone: 'object-contain p-10',
      },
    ],
  },
  {
    eyebrow: 'Memberships',
    cards: [
      {
        title: 'Concierge Care',
        sub: 'Monthly recovery.',
        href: '/subscription',
        image: '/images/avalon-hero-new.jpg',
      },
      {
        title: 'Private Beta',
        sub: 'Founder pricing.',
        href: '/subscription',
        image: '/og-homepage.jpg',
      },
    ],
  },
  {
    eyebrow: 'NAD+',
    cards: [
      {
        title: 'NAD+ 1000mg',
        sub: 'Cellular recovery.',
        href: '/book?protocol=nad&dose=nad_1000&time=asap',
        image: '/bags/optimized/nad-1000.png',
        tone: 'object-contain p-10',
      },
      {
        title: 'NAD+ Launch',
        sub: 'Dose menu live.',
        href: '/protocols#protocol-directory',
        image: '/bags/optimized/nad-1500.png',
        tone: 'object-contain p-10',
      },
    ],
  },
  {
    eyebrow: 'CBD',
    cards: [
      {
        title: 'CBD IV',
        sub: 'Calm. Restore. Recover.',
        href: '/book?protocol=cbd&time=asap',
        image: '/bags/optimized/cbd-132.png',
        tone: 'object-contain p-10',
      },
      {
        title: 'CBD Review',
        sub: 'Approval gated.',
        href: '/protocols#protocol-directory',
        image: '/bags/optimized/cbd-66.png',
        tone: 'object-contain p-10',
      },
    ],
  },
  {
    eyebrow: 'Events',
    cards: [
      {
        title: 'Outside Lands',
        sub: 'Recovery lounge.',
        href: 'mailto:support@avalonvitality.co?subject=Outside%20Lands%20Recovery%20Lounge',
        image: '/recovery-lounge-hero.jpg',
      },
      {
        title: 'Corporate Wellness',
        sub: 'Recovery at work.',
        href: '/corporate',
        image: '/og-b2b.png',
      },
    ],
  },
  {
    eyebrow: 'Launches',
    cards: [
      {
        title: 'Mobile Labs',
        sub: 'Launching soon.',
        href: 'mailto:support@avalonvitality.co?subject=Mobile%20Labs%20Launch',
        image: '/avalon-os-phone.webp',
      },
      {
        title: 'Presale Drops',
        sub: 'Private beta.',
        href: '/subscription',
        image: '/og-homepage.jpg',
      },
    ],
  },
  {
    eyebrow: 'Recovery Stories',
    cards: [
      {
        title: 'Night Out',
        sub: 'Morning restored.',
        href: '/hangover',
        image: '/bags/optimized/recovery.png',
        tone: 'object-contain p-10',
      },
      {
        title: 'Performance',
        sub: 'Ready again.',
        href: '/athlete',
        image: '/bags/optimized/energy.png',
        tone: 'object-contain p-10',
      },
    ],
  },
  {
    eyebrow: 'Locations',
    cards: [
      {
        title: 'Bay Area',
        sub: 'At home.',
        href: '/service-area',
        image: '/images/avalon-hero-new.jpg',
      },
      {
        title: 'Hotels',
        sub: 'Suite recovery.',
        href: '/hotel',
        image: '/recovery-lounge-hero.webp',
      },
    ],
  },
  {
    eyebrow: 'Hiring',
    cards: [
      {
        title: 'Join Avalon',
        sub: 'Build the network.',
        href: '/careers',
        image: '/og-homepage.png',
      },
    ],
  },
];

function DiscoveryCard({ card, index }) {
  const external = card.href.startsWith('mailto:') || card.href.startsWith('http');
  const content = (
    <motion.span
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.58, delay: Math.min(index * 0.035, 0.14), ease: EASE }}
      className="group relative block min-h-[255px] overflow-hidden rounded-[1.55rem] border border-foreground/12 bg-background/34 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12),0_34px_130px_hsl(var(--foreground)/0.14)] backdrop-blur-2xl md:min-h-[390px] md:rounded-[2rem]"
    >
      <span className="absolute inset-0 overflow-hidden">
        <img
          src={card.image}
          alt=""
          className={`h-full w-full opacity-72 saturate-[0.74] transition-transform ease-editorial group-hover:scale-[1.035] ${card.tone || 'object-cover'}`}
          style={{ transitionDuration: '1600ms' }}
          loading="lazy"
        />
      </span>
      <span className="absolute inset-0 bg-gradient-to-b from-black/16 via-black/42 to-black/88" />
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,hsl(var(--foreground)/0.12),transparent_36%),linear-gradient(135deg,hsl(var(--foreground)/0.04),transparent_60%)]" />
      <span className="relative flex min-h-[255px] flex-col justify-end p-5 md:min-h-[390px] md:p-8">
        <span className="max-w-[12ch] font-heading text-[3.35rem] uppercase leading-[0.86] tracking-normal text-foreground md:text-[7rem]">
          {card.title}
        </span>
        {card.sub && (
          <span className="mt-3 max-w-[18ch] font-body text-xl font-semibold leading-tight text-foreground/78 md:text-3xl">
            {card.sub}
          </span>
        )}
        <span className="mt-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-foreground/14 bg-background/38 text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10)] backdrop-blur-xl transition-transform duration-500 group-hover:translate-x-1">
          <ArrowRight className="h-5 w-5" strokeWidth={2.35} />
        </span>
      </span>
    </motion.span>
  );

  if (external) {
    return (
      <a href={card.href} className="block" aria-label={`${card.title}: ${card.sub || 'Open'}`}>
        {content}
      </a>
    );
  }

  return (
    <Link to={card.href} className="block" aria-label={`${card.title}: ${card.sub || 'Open'}`}>
      {content}
    </Link>
  );
}

function DiscoverySection({ section }) {
  return (
    <section className="scroll-mt-28">
      <div className="mb-3 flex items-center justify-between gap-4 px-1 md:mb-4">
        <h2 className="font-body text-[10px] font-black uppercase tracking-[0.24em] text-foreground/52 md:text-xs">
          {section.eyebrow}
        </h2>
        <span className="h-px flex-1 bg-foreground/10" />
      </div>
      <div className="grid gap-3 md:gap-4">
        {section.cards.map((card, index) => (
          <DiscoveryCard key={`${section.eyebrow}-${card.title}`} card={card} index={index} />
        ))}
      </div>
    </section>
  );
}

export default function Events() {
  useSeo({
    title: 'Launches — Avalon Vitality',
    description: 'Browse Avalon launches, therapies, events, memberships, locations, and recovery experiences.',
    path: '/launches',
  });

  return (
    <div className="app-shell relative isolate min-h-screen w-full overflow-x-hidden bg-transparent text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-28 md:px-8 md:pt-32">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-5 md:mb-8"
        >
          <p className="mb-3 font-body text-[10px] font-black uppercase tracking-[0.24em] text-foreground/56">Avalon discovery feed</p>
          <h1 className="font-heading text-[5.25rem] uppercase leading-[0.82] tracking-normal text-foreground md:text-[9rem]">
            Launches
          </h1>
          <p className="mt-4 max-w-xl font-body text-2xl font-semibold leading-tight text-foreground/74 md:text-3xl">
            Browse what is live, next, and private beta.
          </p>
        </motion.header>

        <div className="grid gap-8 md:gap-12">
          {discoverySections.map((section) => (
            <DiscoverySection key={section.eyebrow} section={section} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
