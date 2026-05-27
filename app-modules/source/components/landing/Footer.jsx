import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Clock, MapPin, ChevronDown } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { EASE, premiumTap } from '@/lib/motion';
import LanguageSelect from '@/components/landing/LanguageSelect';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const SERVICES = [
  { label: 'Book',   to: '/book' },
  { label: 'Plans',  to: '/subscription' },
  { label: 'Protocols',   to: '/protocols' },
  { label: 'Launches', to: '/launches' },
  { label: 'Bay Area IV', to: '/mobile-iv-therapy-bay-area' },
  { label: 'Locations', to: '/locations' },
  { label: 'Learn', to: '/learn' },
];

const COMPANY = [
  { label: 'Story',  to: '/our-story' },
  { label: 'Safety', to: '/safety' },
  { label: 'FAQ',    to: '/faq' },
];

const LEGAL = [
  { label: 'Terms',   to: '/terms-of-service' },
  { label: 'Privacy', to: '/privacy-policy' },
];

const GROUPS = [
  { label: 'Services', links: SERVICES },
  { label: 'Company', links: COMPANY },
  { label: 'Legal', links: LEGAL },
  { label: 'Contact', type: 'contact' },
];

const DESKTOP_LINK =
  'avalon-footer-link flex min-h-11 items-center rounded-md px-1.5 py-1 -mx-1.5 font-body text-xs text-foreground/70 transition-colors hover:bg-accent/[0.075] hover:text-foreground';

const DESKTOP_CONTACT_LINK =
  'avalon-footer-link flex min-h-11 items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5 font-body text-xs text-foreground/70 transition-colors hover:bg-accent/[0.075] hover:text-foreground';

function FooterGroup({ group, open, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.55, ease: EASE }}
      className={`group w-full max-w-full rounded-2xl border shadow-[0_18px_70px_hsl(var(--foreground)/0.04)] backdrop-blur-xl transition-colors ${
        open
          ? 'border-accent/24 bg-accent/[0.055]'
          : 'border-foreground/10 bg-background/58 hover:border-accent/24 hover:bg-accent/[0.045]'
      }`}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="font-body text-[10px] tracking-[0.28em] uppercase text-foreground/60">
          {group.label}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="text-foreground/45 transition-colors group-hover:text-foreground/65"
          aria-hidden="true"
        >
          <ChevronDown className="w-4 h-4" strokeWidth={2} />
        </motion.span>
      </motion.button>
      <SmoothDisclosure open={open}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-foreground/[0.07] px-4 py-3">
          {group.type === 'contact' ? (
            <>
              <a href="mailto:support@avalonvitality.co" className="col-span-2 flex min-h-[44px] items-center gap-2 rounded-xl px-2 py-1.5 font-body text-xs text-foreground/70 transition-colors hover:bg-accent/[0.075] hover:text-foreground">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                support@avalonvitality.co
              </a>
              <a href="tel:+14159807708" className="col-span-2 flex min-h-[44px] items-center gap-2 rounded-xl px-2 py-1.5 font-body text-xs text-foreground/70 transition-colors hover:bg-accent/[0.075] hover:text-foreground">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                (415) 980-7708
              </a>
              <div className="col-span-2 flex items-center gap-2 font-body text-[11px] text-foreground/55">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                8AM-8PM
              </div>
              <div className="col-span-2 flex items-center gap-2 font-body text-[11px] text-foreground/55">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                SF Bay Area
              </div>
            </>
          ) : group.links.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="flex min-h-[44px] items-center rounded-xl px-2 py-1.5 font-body text-xs leading-tight text-foreground/70 transition-colors duration-base ease-editorial hover:bg-accent/[0.075] hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </SmoothDisclosure>
    </motion.div>
  );
}

export default function Footer() {
  const [openGroup, setOpenGroup] = useState(null);

  return (
    <footer className="pt-6 pb-4 px-4 md:pt-6 md:pb-4">
      <div className="max-w-6xl mx-auto">

        {/* Brand */}
        <div className="mb-5 md:mb-4">
          <div className="font-heading text-2xl tracking-widest text-foreground">AVALON</div>
          <div className="font-body text-xs tracking-[0.3em] text-foreground/60 -mt-1">VITALITY</div>
          <p className="font-body text-xs text-foreground/55 leading-relaxed mt-3 max-w-sm">
            Clinician-led recovery across the Bay Area.
          </p>
        </div>

        {/* Mobile: compact drop menu */}
        <div className="md:hidden space-y-2.5 mb-6">
          {GROUPS.map((group) => (
            <FooterGroup
              key={group.label}
              group={group}
              open={openGroup === group.label}
              onToggle={() => setOpenGroup(current => current === group.label ? null : group.label)}
            />
          ))}

        </div>

        {/* Mobile: single column stacked. Desktop: 4-col grid */}
        <div className="hidden md:grid md:grid-cols-4 gap-x-6 gap-y-4 mb-4">

          {/* Services */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">Services</p>
            <div className="space-y-0.5">
              {SERVICES.map((l) => (
                <Link key={l.label} to={l.to} className={DESKTOP_LINK}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">Company</p>
            <div className="space-y-0.5">
              {COMPANY.map((l) => (
                <Link key={l.label} to={l.to} className={DESKTOP_LINK}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">Contact</p>
            <div className="space-y-0.5">
              <a href="mailto:support@avalonvitality.co" className={DESKTOP_CONTACT_LINK}>
                <Mail className="w-3.5 h-3.5 shrink-0" />
                support@avalonvitality.co
              </a>
              <a href="tel:+14159807708" className={DESKTOP_CONTACT_LINK}>
                <Phone className="w-3.5 h-3.5 shrink-0" />
                (415) 980-7708
              </a>
              <div className="avalon-footer-link flex min-h-11 items-center gap-2 font-body text-xs text-foreground/50">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                8AM-8PM
              </div>
              <div className="avalon-footer-link flex min-h-11 items-center gap-2 font-body text-xs text-foreground/50">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                SF Bay Area
              </div>
            </div>
          </div>

          {/* Legal */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-2">Legal</p>
            <div className="space-y-0.5">
              {LEGAL.map((l) => (
                <Link key={l.label} to={l.to} className={DESKTOP_LINK}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-foreground/[0.07] pt-3 md:pt-3 space-y-1.5 md:space-y-1">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="font-body text-[11px] text-foreground/45 leading-relaxed">
              © 2026 Avalon Vitality. All rights reserved.
            </p>
            <LanguageSelect />
          </div>
          <p className="font-body text-[11px] text-foreground/45 leading-relaxed">
            California wellness support only. Not emergency care or medical advice.
          </p>
        </div>

      </div>
    </footer>
  );
}
