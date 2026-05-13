import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Search, CheckCircle, XCircle, ChevronDown, ArrowRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';

const EASE = [0.16, 1, 0.3, 1];

// ── Covered zip codes ─────────────────────────────────────────────────────────
const COVERED_ZIPS = new Set([
  // San Francisco
  '94102','94103','94104','94105','94107','94108','94109','94110','94111',
  '94112','94114','94115','94116','94117','94118','94119','94120','94121',
  '94122','94123','94124','94125','94126','94127','94128','94129','94130',
  '94131','94132','94133','94134','94158',
  // Marin
  '94901','94903','94904','94920','94925','94930','94941','94945','94947','94949','94965',
  // Peninsula / South Bay
  '94002','94010','94019','94020','94021','94025','94026','94027','94028',
  '94030','94040','94041','94043','94044','94061','94062','94063','94065',
  '94066','94080','94401','94402','94403','94404',
  '94301','94302','94303','94304','94305','94306',
  '94085','94086','94087','94088','94089',
  // East Bay
  '94501','94502','94530','94547','94549','94556','94563','94596','94597','94598',
  '94601','94602','94603','94605','94606','94607','94608','94609','94610',
  '94611','94612','94613','94618','94619','94621','94702','94703','94704',
  '94705','94706','94707','94708','94709','94710','94720',
]);

const ZONES = [
  {
    region: 'San Francisco',
    sub: 'All 94xxx zip codes — full city coverage',
    areas: [
      'SoMa', 'Financial District', 'Union Square', 'Nob Hill', 'Russian Hill',
      'Pacific Heights', 'Marina District', 'Cow Hollow', 'Hayes Valley',
      'Mission District', 'Castro', 'Noe Valley', 'Bernal Heights', 'Potrero Hill',
      'Mission Bay', 'Dogpatch', 'Embarcadero', 'Chinatown', 'North Beach',
      "Fisherman's Wharf", 'Presidio', 'Outer Sunset', 'Inner Sunset', 'Outer Richmond',
      'Inner Richmond', 'Cole Valley', 'Twin Peaks', 'Glen Park', 'West Portal',
      'Excelsior', 'Visitacion Valley', 'Bayview', 'Tenderloin', 'Lower Haight',
      'Upper Haight', 'Alamo Square', 'Japantown', 'Civic Center', 'Treasure Island',
    ],
  },
  {
    region: 'Marin County',
    sub: 'San Rafael, Mill Valley, Tiburon, and more',
    areas: [
      'San Rafael', 'Mill Valley', 'Tiburon', 'Sausalito', 'Corte Madera',
      'Larkspur', 'Fairfax', 'Novato', 'Greenbrae', 'Kentfield',
      'Ross', 'San Anselmo', 'Belvedere', 'Strawberry',
    ],
  },
  {
    region: 'Peninsula & South Bay',
    sub: 'Palo Alto through San Jose — same-day available',
    areas: [
      'Palo Alto', 'Menlo Park', 'Atherton', 'Portola Valley', 'Woodside',
      'Redwood City', 'San Carlos', 'Belmont', 'San Mateo', 'Foster City',
      'Burlingame', 'Hillsborough', 'San Bruno', 'South San Francisco', 'Brisbane',
      'Daly City', 'Colma', 'Pacifica', 'Half Moon Bay', 'El Granada',
      'Mountain View', 'Los Altos', 'Sunnyvale', 'Cupertino', 'Santa Clara',
      'Campbell', 'Los Gatos', 'Saratoga', 'San Jose (downtown)',
    ],
  },
  {
    region: 'East Bay',
    sub: 'Oakland, Berkeley, Walnut Creek, and surrounding areas',
    areas: [
      'Oakland', 'Berkeley', 'Emeryville', 'Alameda', 'Piedmont',
      'Rockridge', 'Temescal', 'Grand Lake', 'Montclair', 'Fruitvale',
      'San Leandro', 'Albany', 'El Cerrito', 'Richmond', 'Kensington',
      'Orinda', 'Moraga', 'Lafayette', 'Walnut Creek', 'Alamo',
      'Danville', 'San Ramon', 'Pleasanton', 'Livermore', 'Dublin',
    ],
  },
];

function ZipChecker() {
  const [zip, setZip] = useState('');
  const [result, setResult] = useState(null); // null | 'covered' | 'not_covered'

  const check = () => {
    const clean = zip.trim().slice(0, 5);
    if (clean.length < 5) return;
    setResult(COVERED_ZIPS.has(clean) ? 'covered' : 'not_covered');
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') check();
  };

  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
    setZip(val);
    if (result) setResult(null);
  };

  return (
    <div className="w-full max-w-lg">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" strokeWidth={1.5} />
          <input
            type="text"
            inputMode="numeric"
            value={zip}
            onChange={handleChange}
            onKeyDown={handleKey}
            placeholder="Enter your zip code"
            maxLength={5}
            className="w-full pl-11 pr-4 py-4 rounded-2xl font-body text-sm text-foreground bg-foreground/[0.04] border border-foreground/[0.10] placeholder:text-foreground/25 focus:outline-none focus:border-foreground/30 transition-colors"
          />
        </div>
        <button
          onClick={check}
          disabled={zip.length < 5}
          className="px-6 py-4 rounded-2xl font-body text-xs tracking-[0.2em] uppercase font-semibold bg-foreground text-background hover:bg-foreground/85 disabled:opacity-30 transition-colors shrink-0"
        >
          Check
        </button>
      </div>

      <AnimatePresence mode="wait">
        {result === 'covered' && (
          <motion.div
            key="covered"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="mt-4 flex items-start gap-3 rounded-2xl border border-accent/20 bg-accent/[0.06] px-5 py-4"
          >
            <CheckCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="font-body text-sm text-foreground font-medium">We cover {zip}.</p>
              <p className="font-body text-xs text-foreground/50 mt-0.5">Same-day availability in most cases. Request your visit to confirm timing.</p>
              <Link
                to="/store"
                className="inline-flex items-center gap-1.5 mt-3 font-body text-[11px] tracking-[0.2em] uppercase text-accent hover:text-foreground transition-colors"
              >
                Request a Visit <ArrowRight className="w-3 h-3" strokeWidth={2} />
              </Link>
            </div>
          </motion.div>
        )}
        {result === 'not_covered' && (
          <motion.div
            key="not"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="mt-4 flex items-start gap-3 rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] px-5 py-4"
          >
            <XCircle className="w-5 h-5 text-foreground/30 shrink-0 mt-0.5" strokeWidth={1.5} />
            <div>
              <p className="font-body text-sm text-foreground/70">{zip} is outside our current coverage area.</p>
              <p className="font-body text-xs text-foreground/40 mt-0.5">We're expanding — reach out and we'll do our best to accommodate.</p>
              <a
                href="mailto:hello@avalonvitality.co"
                className="inline-flex items-center gap-1.5 mt-3 font-body text-[11px] tracking-[0.2em] uppercase text-foreground/40 hover:text-foreground transition-colors"
              >
                Contact Us <ArrowRight className="w-3 h-3" strokeWidth={2} />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RegionAccordion({ zone, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-foreground/[0.08] rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-foreground/[0.02] transition-colors"
      >
        <div>
          <p className="font-heading text-xl md:text-2xl text-foreground tracking-wide uppercase">{zone.region}</p>
          <p className="font-body text-xs text-foreground/40 mt-0.5">{zone.sub}</p>
        </div>
        <ChevronDown
          className="w-5 h-5 text-foreground/30 shrink-0 transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          strokeWidth={1.5}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 border-t border-foreground/[0.06]">
              {/* Hidden SEO text — all city/neighborhood names as a paragraph Google can crawl */}
              <p className="sr-only">
                Avalon Vitality provides mobile IV therapy and IM injection services in {zone.region}, including: {zone.areas.join(', ')}.
              </p>
              <div className="flex flex-wrap gap-2 pt-5">
                {zone.areas.map((area) => (
                  <span
                    key={area}
                    className="font-body text-[11px] tracking-[0.1em] text-foreground/55 border border-foreground/[0.08] rounded-full px-3.5 py-1.5"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ServiceArea() {
  useSeo({ title: 'Service Area — Avalon Vitality', description: 'Avalon Vitality serves San Francisco, Peninsula, East Bay, and Marin.', path: '/service-area' });
  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero + Zip Checker */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.p
              className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
            >
              Service Area
            </motion.p>
            <motion.h1
              className="font-heading text-6xl md:text-8xl lg:text-[9rem] text-foreground uppercase leading-[0.9] mb-5"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
            >
              We Come<br />to You
            </motion.h1>
            <motion.p
              className="font-body text-sm md:text-base text-foreground/55 max-w-xl mb-10"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
            >
              A licensed RN comes to your home, hotel, office, or event with IV drips and IM injections — across the SF Bay Area, no clinic visit required.
            </motion.p>

            {/* Zip code checker */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.2 }}
            >
              <p className="font-body text-[11px] tracking-[0.25em] uppercase text-foreground/35 mb-4">Check your zip code</p>
              <ZipChecker />
            </motion.div>
          </div>
        </section>

        {/* Coverage by region — collapsible for SEO */}
        <section className="py-12 md:py-16 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="mb-8"
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE }}
            >
              <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">Coverage Zones</p>
              <h2 className="font-heading text-4xl md:text-6xl text-foreground uppercase leading-[0.9]">
                Where We Serve
              </h2>
              <p className="font-body text-sm text-foreground/40 mt-3">Expand any region to see covered cities and neighborhoods.</p>
            </motion.div>

            <div className="space-y-3">
              {ZONES.map((zone, i) => (
                <motion.div
                  key={zone.region}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.07 }}
                >
                  <RegionAccordion zone={zone} defaultOpen={i === 0} />
                </motion.div>
              ))}
            </div>

            <motion.p
              className="font-body text-xs text-foreground/25 mt-6"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
            >
              Don't see your area? <a href="mailto:hello@avalonvitality.co" className="text-accent hover:text-foreground transition-colors">Contact us</a> — we'll do our best to accommodate.
            </motion.p>
          </div>
        </section>

        {/* Quick facts */}
        <section className="py-12 md:py-16 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            {[
              { label: 'Same-Day', desc: 'Available in most Bay Area zip codes for requests before 2pm.' },
              { label: 'No Travel Fee', desc: 'Within our standard service zone. Extended zones may apply small surcharge.' },
              { label: 'Hotel Friendly', desc: 'Your RN arrives directly to your room — no lobby pickup, no waiting.' },
            ].map((f, i) => (
              <motion.div
                key={f.label}
                className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.02] p-6"
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.6, ease: EASE, delay: i * 0.08 }}
              >
                <p className="font-heading text-2xl text-accent mb-2 uppercase tracking-wide">{f.label}</p>
                <p className="font-body text-sm text-foreground/50">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-20 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto text-center">
            <motion.h2
              className="font-heading text-5xl md:text-7xl text-foreground uppercase leading-[0.9] mb-6"
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease: EASE }}
            >
              Ready to Book?
            </motion.h2>
            <motion.div
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
            >
              <Link
                to="/store"
                className="inline-block px-10 py-4 rounded-full bg-foreground text-background font-body text-xs tracking-[0.2em] uppercase font-semibold hover:bg-foreground/85 transition-colors"
              >
                Request a Visit
              </Link>
            </motion.div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
