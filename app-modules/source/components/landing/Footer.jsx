import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, Phone, Clock, MapPin, ChevronDown, Layers, Building2, Scale } from 'lucide-react';
import { motion } from '@/components/ui/PageTransitionMotion';
import { EASE, premiumTap } from '@/lib/motion';
import LanguageSelect from '@/components/landing/LanguageSelect';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const SERVICES = [
  { label: 'Book',       to: '/book' },
  { label: 'IV Therapy', to: '/protocols' },
  { label: 'Plans',      to: '/subscription' },
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
  { label: 'Services', icon: Layers, links: SERVICES },
  { label: 'Company', icon: Building2, links: COMPANY },
  { label: 'Legal', icon: Scale, links: LEGAL },
  { label: 'Contact', icon: Mail, type: 'contact' },
];

const DESKTOP_LINK =
  'av-glass-widget avalon-footer-link group/link flex min-h-11 items-center justify-between gap-3 rounded-2xl border px-3 font-body text-[11px] uppercase leading-none tracking-[0.14em] text-foreground/64 transition-colors hover:text-foreground';

const DESKTOP_CONTACT_LINK =
  'av-glass-widget avalon-footer-link group/link flex min-h-11 items-center justify-between gap-3 rounded-2xl border px-3 font-body text-[11px] leading-none text-foreground/64 transition-colors hover:text-foreground';

function FooterLink({ to, children }) {
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={premiumTap} transition={{ duration: 0.22, ease: EASE }}>
      <Link to={to} className={DESKTOP_LINK}>
        <span className="whitespace-nowrap">{children}</span>
        <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover/link:opacity-70" strokeWidth={1.9} />
      </Link>
    </motion.div>
  );
}

function FooterContactLink({ href, icon: Icon, children }) {
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={premiumTap} transition={{ duration: 0.22, ease: EASE }}>
      <a href={href} className={DESKTOP_CONTACT_LINK}>
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{children}</span>
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-70" strokeWidth={1.9} />
      </a>
    </motion.div>
  );
}

// Desktop footer groups render expanded — footer links are wayfinding (and SEO
// surface), so on desktop they stay visible rather than hidden behind a click.
// The mobile footer keeps its compact accordion (FooterGroup) below.
function FooterDesktopGroup({ title, icon: Icon, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-32px' }}
      transition={{ duration: 0.55, ease: EASE }}
        className="av-glass-card relative overflow-hidden rounded-[1.15rem] border transition-colors"
    >
      <div className="relative flex min-h-[54px] w-full items-center gap-2.5 px-3">
            <span className="flex min-w-0 items-center gap-2.5">
          {Icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/[0.08] bg-background/80 text-foreground/58">
              <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
            </span>
          )}
          <span className="font-body text-[11px] uppercase tracking-[0.28em] text-foreground/62">{title}</span>
        </span>
      </div>
      <div className="relative grid gap-1 border-t border-foreground/[0.07] p-2">{children}</div>
    </motion.div>
  );
}

function FooterGroup({ group, open, onToggle }) {
  const Icon = group.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.55, ease: EASE }}
      className={`av-treatment-card group relative w-full max-w-full overflow-hidden rounded-2xl border transition-colors duration-base ease-editorial ${open ? 'is-open' : ''}`}
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="relative flex min-h-[72px] w-full items-center justify-between gap-3 px-4 text-left transition-colors duration-base ease-editorial [@media(hover:hover)]:hover:bg-foreground/[0.025]"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="av-treatment-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
            <Icon className="h-4.5 w-4.5 text-accent" strokeWidth={1.8} />
          </span>
          <span className="font-heading text-xl uppercase leading-none tracking-[0.06em] text-foreground">
            {group.label}
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="shrink-0 text-foreground/35 transition-colors group-hover:text-foreground/65"
          aria-hidden="true"
        >
          <ChevronDown className="w-4 h-4" strokeWidth={2} />
        </motion.span>
      </motion.button>
      <SmoothDisclosure open={open}>
        <div className="grid grid-cols-2 gap-x-2 gap-y-2 border-t border-foreground/[0.07] px-4 py-3">
          {group.type === 'contact' ? (
            <>
              <a href="mailto:support@avalonvitality.co" className="col-span-2 flex min-h-[44px] items-center gap-2 rounded-xl border border-foreground/[0.07] bg-background/80 px-3 py-1.5 font-body text-xs text-foreground/70 transition-colors hover:bg-foreground/[0.055] hover:text-foreground">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                support@avalonvitality.co
              </a>
              <a href="tel:+14159807708" className="col-span-2 flex min-h-[44px] items-center gap-2 rounded-xl border border-foreground/[0.07] bg-background/80 px-3 py-1.5 font-body text-xs text-foreground/70 transition-colors hover:bg-foreground/[0.055] hover:text-foreground">
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
              className="flex min-h-[44px] items-center justify-between rounded-xl border border-foreground/[0.07] bg-background/80 px-3 py-1.5 font-body text-xs leading-tight text-foreground/70 transition-colors duration-base ease-editorial hover:bg-foreground/[0.055] hover:text-foreground"
            >
              <span>{l.label}</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-45" strokeWidth={1.9} />
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
    <footer className="px-4 pb-4 pt-6 md:pb-4 md:pt-6">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.65, ease: EASE }}
        className="av-glass-card relative mx-auto max-w-6xl overflow-hidden rounded-[1.35rem] border p-3 md:p-4"
      >
        <div className="relative">

        {/* Brand */}
        <div className="mb-3 flex flex-col gap-2 md:mb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="font-heading text-xl tracking-widest text-foreground md:text-2xl">AVALON</div>
            <div className="-mt-1 font-body text-[11px] tracking-[0.3em] text-foreground/60 md:text-xs">VITALITY</div>
          </div>
          <p className="max-w-sm font-body text-[11px] leading-snug text-foreground/55 md:text-right md:text-xs">
            Clinician-led recovery across the Bay Area.
          </p>
        </div>

        {/* Mobile: compact drop menu */}
        <div className="mb-4 space-y-2 md:hidden">
          {GROUPS.map((group) => (
            <FooterGroup
              key={group.label}
              group={group}
              open={openGroup === group.label}
              onToggle={() => setOpenGroup(current => current === group.label ? null : group.label)}
            />
          ))}

        </div>

        {/* Desktop: hidden accordions */}
        <div className="mb-3 hidden gap-2 md:grid md:grid-cols-4">

          {/* Services */}
          <FooterDesktopGroup title="Services" icon={Layers}>
            <div className="grid grid-cols-2 gap-1.5">
              {SERVICES.map((l) => (
                <FooterLink key={l.label} to={l.to}>{l.label}</FooterLink>
              ))}
            </div>
          </FooterDesktopGroup>

          {/* Company */}
          <FooterDesktopGroup title="Company" icon={Building2}>
              {COMPANY.map((l) => (
                <FooterLink key={l.label} to={l.to}>{l.label}</FooterLink>
              ))}
          </FooterDesktopGroup>

          {/* Contact */}
          <FooterDesktopGroup title="Contact" icon={Mail}>
              <FooterContactLink href="mailto:support@avalonvitality.co" icon={Mail}>
                support@avalonvitality.co
              </FooterContactLink>
              <FooterContactLink href="tel:+14159807708" icon={Phone}>
                (415) 980-7708
              </FooterContactLink>
              <div className="avalon-footer-link flex min-h-11 items-center gap-2 rounded-2xl border border-foreground/[0.055] bg-background/80 px-3 font-body text-[11px] leading-none text-foreground/64">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                8AM-8PM
              </div>
              <div className="avalon-footer-link flex min-h-11 items-center gap-2 rounded-2xl border border-foreground/[0.055] bg-background/80 px-3 font-body text-[11px] leading-none text-foreground/64">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                SF Bay Area
              </div>
          </FooterDesktopGroup>

          {/* Legal */}
          <FooterDesktopGroup title="Legal" icon={Scale}>
              {LEGAL.map((l) => (
                <FooterLink key={l.label} to={l.to}>{l.label}</FooterLink>
              ))}
          </FooterDesktopGroup>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-foreground/[0.07] pt-2 md:pt-2 space-y-1 md:space-y-0.5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="font-body text-[11px] text-foreground/58 leading-tight">
              © 2026 Avalon Vitality. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <LanguageSelect />
            </div>
          </div>
          <p className="font-body text-[11px] text-foreground/58 leading-tight">
            California wellness support only. Not emergency care or medical advice.
          </p>
        </div>

        </div>
      </motion.div>
    </footer>
  );
}
