import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, Clock, MapPin, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE, premiumTap } from '@/lib/motion';

const SERVICES = [
  { label: 'Request a Visit',  to: '/book' },
  { label: 'Subscription',     to: '/subscription' },
  { label: 'Gift Cards',       to: '/gift' },
  { label: 'For Athletes',     to: '/athlete' },
  { label: 'For Teams',        to: '/corporate' },
  { label: 'For Events',       to: '/events' },
  { label: 'Hotel Delivery',   to: '/hotel' },
];

const COMPANY = [
  { label: 'Our Story',          to: '/our-story' },
  { label: 'Our Team',           to: '/team' },
  { label: 'Service Area',       to: '/service-area' },
  { label: 'FAQ',                to: '/faq' },
  { label: 'Safety',             to: '/safety' },
  { label: 'Ingredients',        to: '/ingredients' },
  { label: 'Medical Direction',  to: '/medical-direction' },
  { label: 'Press',              to: '/press' },
];

const LEGAL = [
  { label: 'Terms of Service',  to: '/terms-of-service' },
  { label: 'Privacy Policy',    to: '/privacy-policy' },
  { label: 'Cookie Policy',     to: '/cookie-policy' },
  { label: 'HIPAA Notice',      to: '/hipaa-notice' },
];

const GROUPS = [
  { label: 'Services', links: SERVICES },
  { label: 'Company', links: COMPANY },
  { label: 'Legal', links: LEGAL },
  { label: 'Contact', type: 'contact' },
];

function FooterGroup({ group, open, onToggle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-24px' }}
      transition={{ duration: 0.55, ease: EASE }}
      className="w-full max-w-full rounded-2xl border border-foreground/10 bg-white/[0.055] backdrop-blur-xl overflow-hidden"
    >
      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={premiumTap}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="font-body text-[10px] tracking-[0.28em] uppercase text-foreground/60">
          {group.label}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="text-foreground/45"
          aria-hidden="true"
        >
          <ChevronDown className="w-4 h-4" strokeWidth={2} />
        </motion.span>
      </motion.button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.38, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-foreground/[0.07] px-4 py-3">
              {group.type === 'contact' ? (
                <>
                  <a href="mailto:support@avalonvitality.co" className="col-span-2 flex items-center gap-2 font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    support@avalonvitality.co
                  </a>
                  <a href="tel:+14159807708" className="col-span-2 flex items-center gap-2 font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
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
                  className="font-body text-xs leading-tight text-foreground/70 hover:text-foreground transition-colors duration-base ease-editorial"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function Footer() {
  const [openGroup, setOpenGroup] = useState(null);

  return (
    <footer className="pt-6 pb-5 px-4 md:pt-10 md:pb-8">
      <div className="max-w-6xl mx-auto">

        {/* Brand */}
        <div className="mb-5 md:mb-8">
          <div className="font-heading text-2xl tracking-widest text-foreground">AVALON</div>
          <div className="font-body text-xs tracking-[0.3em] text-foreground/60 -mt-1">VITALITY</div>
          <p className="font-body text-xs text-foreground/55 leading-relaxed mt-3 max-w-sm">
            Intelligent wellness protocols administered by California-licensed clinicians across the SF Bay Area.
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
        <div className="hidden md:grid md:grid-cols-4 gap-8 mb-8">

          {/* Services */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-3">Services</p>
            <div className="space-y-2.5">
              {SERVICES.map((l) => (
                <Link key={l.label} to={l.to} className="block font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-3">Company</p>
            <div className="space-y-2.5">
              {COMPANY.map((l) => (
                <Link key={l.label} to={l.to} className="block font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-3">Contact</p>
            <div className="space-y-3">
              <a href="mailto:support@avalonvitality.co" className="flex items-center gap-2 font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                support@avalonvitality.co
              </a>
              <a href="tel:+14159807708" className="flex items-center gap-2 font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                (415) 980-7708
              </a>
              <div className="flex items-center gap-2 font-body text-xs text-foreground/50">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                Mon–Sun · 8AM–8PM
              </div>
              <div className="flex items-center gap-2 font-body text-xs text-foreground/50">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                San Francisco Bay Area · CA
              </div>
            </div>
          </div>

          {/* Legal */}
          <div>
            <p className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/40 mb-3">Legal</p>
            <div className="space-y-2.5">
              {LEGAL.map((l) => (
                <Link key={l.label} to={l.to} className="block font-body text-xs text-foreground/70 hover:text-foreground transition-colors">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-foreground/[0.07] pt-4 md:pt-6 space-y-1.5 md:space-y-3">
          <p className="font-body text-[9px] md:text-[10px] text-foreground/35 leading-snug md:leading-relaxed">
            © 2026 Avalon Vitality. All rights reserved.
          </p>
          <p className="font-body text-[9px] md:text-[10px] text-foreground/30 leading-snug md:leading-relaxed">
            Services provided exclusively to California residents physically located in California at the time of service.
          </p>
          <p className="font-body text-[9px] md:text-[10px] text-foreground/25 leading-snug md:leading-relaxed">
            Avalon Vitality provides wellness and recovery support. This is not emergency medical care. If you are experiencing a medical emergency, call 911 immediately.
          </p>
          <p className="font-body text-[9px] md:text-[10px] text-foreground/25 leading-snug md:leading-relaxed">
            These statements have not been evaluated by the FDA. Not intended to diagnose, treat, cure, or prevent any disease.
          </p>
        </div>

      </div>
    </footer>
  );
}
