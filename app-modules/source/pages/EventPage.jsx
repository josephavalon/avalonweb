import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from '@/components/ui/PageTransitionMotion';
import { ArrowLeft, Calendar, MapPin, Shield, Users, Ticket } from 'lucide-react';
import Navbar from '../../../src/components/landing/Navbar';
import Footer from '../../../src/components/landing/Footer';
import { findEventBySlug } from '../../../src/data/events';
import { readEventPresales } from '@/lib/platformOps';
import PremiumButton from '@/components/ui/PremiumButton';

const EASE = [0.16, 1, 0.3, 1];

export default function EventPage() {
  const { slug } = useParams();
  const saved = readEventPresales().events.find((item) => item.slug === slug || item.id === slug);
  const event = saved ? {
    slug: saved.slug,
    title: saved.headline || saved.name,
    date: saved.date,
    location: saved.venue,
    desc: saved.description,
    briefing: saved.description,
    hostName: saved.partner,
    hostRole: 'Launch partner',
    when: [saved.date, saved.window].filter(Boolean).join(' · '),
    venue: saved.venue,
    capacity: saved.capacity ? `${saved.capacity} presale spots` : 'Capacity pending',
    cover: '/backgrounds/iv-vitamins-hero.webp',
    status: saved.publishStatus,
    publicMode: saved.publicMode,
    presaleEnabled: saved.presaleEnabled,
    ticketSystem: saved.ticketSystem,
    ticketTiers: saved.ticketTiers,
    presaleId: saved.id,
    service: saved.service,
    gfeTiming: saved.gfeTiming,
    acuityHandoff: saved.acuityStatus,
  } : findEventBySlug(slug);

  if (!event) {
    return (
      <div className="bg-background min-h-screen flex flex-col">
        <Navbar />
        <section className="flex-1 flex items-center justify-center px-6 py-24">
          <div className="max-w-xl text-center">
            <h1 className="font-heading text-4xl md:text-6xl text-foreground tracking-wide mb-6">Launch not found</h1>
            <Link to="/launches" className="inline-flex items-center gap-2 text-accent hover:text-accent/70 font-body text-xs tracking-widest uppercase">
              <ArrowLeft className="w-4 h-4" /> Back to Launches
            </Link>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  const cover = event.cover || '/backgrounds/iv-vitamins-hero.webp';

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Navbar />

      <section className="pt-28 md:pt-36 pb-12 md:pb-20 px-5 md:px-10">
        <div className="max-w-5xl mx-auto">
            <Link to="/launches" className="mb-7 inline-flex min-h-10 items-center gap-2 text-foreground/48 hover:text-foreground font-body text-xs tracking-[0.25em] uppercase">
            <ArrowLeft className="w-3 h-3" /> Launches
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: EASE }}
            className="mb-7"
          >
            <h1 className="font-heading text-[4rem] uppercase leading-[0.84] tracking-tight text-foreground md:text-[7rem]">
              {event.title}
            </h1>
          </motion.div>

          <div className="grid md:grid-cols-[1fr_360px] gap-7 md:gap-10">
            {/* LEFT: cover poster + body */}
            <div>
              <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE }} className="av-glass-sweep relative mb-7 aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-foreground/[0.12] bg-background/62 shadow-[0_28px_110px_hsl(var(--foreground)/0.12)] backdrop-blur-2xl">
                <motion.img
                  src={cover}
                  alt={event.title}
                  className="h-full w-full object-cover"
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1.015, x: ['0%', '-1.5%', '0%'] }}
                  transition={{ duration: 9, ease: EASE, repeat: Infinity, repeatType: 'mirror' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="text-xs tracking-[0.35em] text-foreground font-body uppercase mb-2">{event.date}</p>
                  <p className="font-body text-sm text-foreground/70">{event.venue || event.location}</p>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1, ease: EASE }}>
                <p className="font-body text-xs tracking-[0.35em] text-foreground/42 uppercase mb-3">About</p>
                <p className="font-body text-base md:text-lg text-foreground/68 leading-relaxed">
                  {event.briefing || event.desc}
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: EASE }} className="mt-8 rounded-[1.35rem] border border-foreground/[0.10] bg-background/58 p-4 shadow-[0_18px_70px_hsl(var(--foreground)/0.055)] backdrop-blur-xl">
                <p className="font-body text-xs tracking-[0.35em] text-foreground/42 uppercase mb-5">Hosted by</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border border-foreground/[0.12] bg-foreground/[0.05] backdrop-blur-md flex items-center justify-center">
                    <span className="font-heading text-sm text-foreground tracking-widest">AV</span>
                  </div>
                  <div>
                    <p className="font-heading text-xl text-foreground tracking-wide leading-tight">{event.hostName || 'Avalon Vitality'}</p>
                    <p className="font-body text-xs tracking-[0.25em] text-muted-foreground uppercase mt-0.5">{event.hostRole || 'Host'}</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* RIGHT: details card + CTA */}
            <motion.aside initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: EASE }} className="md:sticky md:top-28 self-start">
              <div className="border border-foreground/[0.12] bg-background/68 backdrop-blur-2xl rounded-[1.75rem] p-5 shadow-[0_28px_110px_hsl(var(--foreground)/0.12)] md:p-6">
                <div className="space-y-5 mb-6">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div>
                      <p className="font-body text-xs tracking-[0.3em] text-muted-foreground uppercase mb-1">When</p>
                      <p className="font-body text-sm text-foreground">{event.when || event.date}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div>
                      <p className="font-body text-xs tracking-[0.3em] text-muted-foreground uppercase mb-1">Where</p>
                      <p className="font-body text-sm text-foreground">{event.venue || event.location}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div>
                      <p className="font-body text-xs tracking-[0.3em] text-muted-foreground uppercase mb-1">Capacity</p>
                      <p className="font-body text-sm text-foreground">{event.capacity || 'TBA'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Shield className="w-4 h-4 text-accent shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div>
                      <p className="font-body text-xs tracking-[0.3em] text-muted-foreground uppercase mb-1">Clinical</p>
                      <p className="font-body text-sm text-foreground">{event.gfeTiming || 'GFE before service'}</p>
                    </div>
                  </div>
                </div>

                {event.ticketSystem && event.ticketTiers?.length > 0 && (
                  <div className="mb-5 space-y-2">
                    {event.ticketTiers.map((tier) => (
                      <motion.div
                        key={tier.name}
                        whileHover={{ y: -2 }}
                        transition={{ duration: 0.36, ease: EASE }}
                        className="av-glass-sweep relative overflow-hidden rounded-2xl border border-foreground/[0.08] bg-foreground/[0.035] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-body text-sm font-semibold text-foreground">{tier.name}</p>
                          <p className="font-heading text-lg text-foreground">{tier.price}</p>
                        </div>
                        <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground/48">{tier.detail}</p>
                      </motion.div>
                    ))}
                  </div>
                )}

                <PremiumButton
                  as={Link}
                  wrapperClassName="w-full"
                  to={event.presaleEnabled ? `/presale/${event.presaleId || event.slug}` : '/launches#inquiry'}
                  className="group flex w-full items-center justify-center gap-2 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold rounded-full py-3.5 hover:bg-foreground/90 transition-colors"
                >
                  <Ticket className="w-4 h-4" strokeWidth={2} />
                  {event.presaleEnabled ? 'Open Presale' : 'Launch'}
                </PremiumButton>
                <PremiumButton
                  as={Link}
                  wrapperClassName="mt-3 w-full"
                  to="/launches#inquiry"
                  className="block w-full text-center border border-foreground/30 text-foreground font-body text-xs tracking-widest uppercase font-semibold rounded-full py-3.5 hover:border-foreground transition-colors"
                >
                  Plan Launch
                </PremiumButton>

                <p className="font-body text-xs text-foreground/48 leading-relaxed mt-5 text-center">
                  Presales queue Acuity and pre-launch GFE review.
                </p>
              </div>
            </motion.aside>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
