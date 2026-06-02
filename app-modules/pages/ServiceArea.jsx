import React, { useState } from 'react';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import { Link } from 'react-router-dom';
import { Search, CheckCircle, XCircle, ChevronDown, ArrowRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useSeo } from '@/lib/seo';
import { COVERED_ZIPS } from '@/lib/serviceArea';
import { matchServiceArea } from '@/lib/osRules';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const EASE = [0.16, 1, 0.3, 1];

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

const ALL_SERVICE_AREAS = ZONES.flatMap((zone) => zone.areas);
const PRIMARY_SERVICE_AREAS = [
  'San Francisco',
  'Oakland',
  'Berkeley',
  'Alameda',
  'Emeryville',
  'Walnut Creek',
  'Lafayette',
  'Orinda',
  'Danville',
  'San Ramon',
  'Palo Alto',
  'Menlo Park',
  'Redwood City',
  'San Mateo',
  'Burlingame',
  'South San Francisco',
  'Daly City',
  'Mountain View',
  'Sunnyvale',
  'Cupertino',
  'Santa Clara',
  'San Jose',
  'Mill Valley',
  'Sausalito',
  'Tiburon',
  'San Rafael',
  'Novato',
];

const serviceAreaJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://www.avalonvitality.co/service-area#webpage',
      url: 'https://www.avalonvitality.co/service-area',
      name: 'Mobile IV Therapy Service Area in the San Francisco Bay Area',
      description:
        'Avalon Vitality provides mobile IV therapy and IM injections across San Francisco, Marin, the Peninsula, South Bay, and East Bay.',
      isPartOf: { '@id': 'https://www.avalonvitality.co/#website' },
      about: { '@id': 'https://www.avalonvitality.co/#localbusiness' },
    },
    {
      '@type': 'MedicalBusiness',
      '@id': 'https://www.avalonvitality.co/#localbusiness',
      name: 'Avalon Vitality',
      url: 'https://www.avalonvitality.co',
      medicalSpecialty: 'IV Therapy',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'San Francisco',
        addressRegion: 'CA',
        addressCountry: 'US',
      },
      areaServed: PRIMARY_SERVICE_AREAS.map((name) => ({
        '@type': 'City',
        name,
        containedInPlace: {
          '@type': 'AdministrativeArea',
          name: 'San Francisco Bay Area',
        },
      })),
      description:
        'RN-administered mobile IV drips and IM injections delivered to homes, hotels, offices, and events throughout the San Francisco Bay Area.',
    },
    {
      '@type': 'Service',
      '@id': 'https://www.avalonvitality.co/service-area#mobile-iv-therapy',
      name: 'Mobile IV Therapy in the San Francisco Bay Area',
      serviceType: 'Mobile IV therapy and IM injections',
      provider: { '@id': 'https://www.avalonvitality.co/#localbusiness' },
      areaServed: PRIMARY_SERVICE_AREAS.map((name) => ({
        '@type': 'City',
        name,
      })),
    },
  ],
};

function ZipChecker() {
  const [zip, setZip] = useState('');
  const [result, setResult] = useState(null);

  const check = () => {
    const clean = zip.trim();
    if (clean.length < 3) return;
    setResult(matchServiceArea(clean, ZONES, COVERED_ZIPS));
  };

  const handleKey = (e) => {
    if (e.key === 'Enter') check();
  };

  const handleChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9\s-]/g, '').slice(0, 32);
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
            placeholder="Enter ZIP or city"
            maxLength={32}
            className="w-full pl-11 pr-4 py-4 rounded-2xl font-body text-sm text-foreground bg-foreground/[0.04] border border-foreground/[0.10] placeholder:text-foreground/25 focus:outline-none focus:border-foreground/30 transition-colors"
          />
        </div>
        <button
          onClick={check}
          disabled={zip.trim().length < 3}
          className="px-6 py-4 rounded-2xl font-body text-xs tracking-[0.2em] uppercase font-semibold bg-foreground text-background hover:bg-foreground/85 disabled:opacity-30 transition-colors shrink-0"
        >
          Check
        </button>
      </div>

      <AnimatePresence mode="wait">
        {result?.status === 'covered' && (
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
              <p className="font-body text-sm text-foreground font-medium">We cover {result.label}.</p>
              <p className="font-body text-xs text-foreground/50 mt-0.5">{result.zone} · {result.window}. Book to confirm.</p>
              <Link
                to="/store"
                className="inline-flex items-center gap-1.5 mt-3 font-body text-[11px] tracking-[0.2em] uppercase text-accent hover:text-foreground transition-colors"
              >
                Book <ArrowRight className="w-3 h-3" strokeWidth={2} />
              </Link>
            </div>
          </motion.div>
        )}
        {result?.status === 'not_covered' && (
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
              <p className="font-body text-xs text-foreground/40 mt-0.5">Outside current coverage.</p>
              <a
                href="mailto:hello@avalonvitality.co"
                className="inline-flex items-center gap-1.5 mt-3 font-body text-[11px] tracking-[0.2em] uppercase text-foreground/40 hover:text-foreground transition-colors"
              >
                Contact <ArrowRight className="w-3 h-3" strokeWidth={2} />
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

      <SmoothDisclosure open={open}>
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
      </SmoothDisclosure>
    </div>
  );
}

export default function ServiceArea() {
  useSeo({
    title: 'Mobile IV Therapy Service Area in the San Francisco Bay Area — Avalon Vitality',
    description:
      'Avalon Vitality delivers RN-administered mobile IV therapy and IM injections across San Francisco, Oakland, Berkeley, Marin, Peninsula, South Bay, and East Bay cities.',
    path: '/service-area',
    jsonLd: serviceAreaJsonLd,
  });

  return (
    <div className="bg-background min-h-screen w-full">
      <Navbar />
      <main className="pt-24 md:pt-28">

        {/* Hero + Zip Checker */}
        <section className="py-16 md:py-24 px-5 md:px-12 lg:px-20">
          <div className="max-w-5xl mx-auto">
            <motion.h1
              className="font-heading text-6xl md:text-8xl lg:text-[9rem] text-foreground uppercase leading-[0.9] mb-5"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
            >
              Bay Area<br />IV Therapy
            </motion.h1>
            <motion.p
              className="font-body text-sm md:text-base text-foreground/55 max-w-xl mb-10"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.12 }}
            >
              Mobile IV therapy and IM injections delivered by a licensed RN across San Francisco, Marin, the Peninsula, South Bay, and East Bay — no clinic visit required.
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

        {/* Bay Area SEO overview */}
        <section className="py-10 md:py-14 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto grid md:grid-cols-[0.95fr_1.25fr] gap-8 md:gap-12 items-start">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <h2 className="font-heading text-4xl md:text-6xl text-foreground uppercase leading-[0.9]">
                Mobile IVs Across the Bay
              </h2>
              <p className="font-body text-sm text-foreground/50 mt-4 leading-relaxed">
                Avalon Vitality provides concierge mobile IV therapy in the San Francisco Bay Area, including same-day IV drips and IM shots for homes, hotels, offices, private events, and team recovery.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.08 }}
              className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-5 md:p-6"
            >
              <h3 className="font-body text-[10px] tracking-[0.3em] uppercase text-foreground/35 mb-4">
                Popular Mobile IV Service Areas
              </h3>
              <div className="flex flex-wrap gap-2">
                {PRIMARY_SERVICE_AREAS.map((area) => (
                  <span
                    key={area}
                    className="font-body text-[11px] tracking-[0.08em] text-foreground/60 border border-foreground/[0.08] rounded-full px-3.5 py-1.5 bg-background/40"
                  >
                    {area}
                  </span>
                ))}
              </div>
              <p className="sr-only">
                Avalon Vitality mobile IV therapy service areas include {ALL_SERVICE_AREAS.join(', ')}.
              </p>
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
              <h2 className="font-heading text-4xl md:text-6xl text-foreground uppercase leading-[0.9]">
                Where We Serve
              </h2>
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
                  <RegionAccordion zone={zone} defaultOpen={false} />
                </motion.div>
              ))}
            </div>

            <motion.p
              className="font-body text-xs text-foreground/25 mt-6"
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
            >
              Outside coverage? <a href="mailto:hello@avalonvitality.co" className="inline-flex min-h-[44px] items-center text-accent hover:text-foreground transition-colors">Contact us</a>.
            </motion.p>
          </div>
        </section>

        {/* Quick facts */}
        <section className="py-12 md:py-16 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]">
          <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
            {[
              { label: 'Same-day', desc: 'Most ZIPs before 2pm.' },
              { label: 'Travel included', desc: 'Standard zone.' },
              { label: 'Hotel-ready', desc: 'RN to room.' },
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

      </main>
      <Footer />
    </div>
  );
}
