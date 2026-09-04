import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Clock3,
  ClipboardCheck,
  Compass,
  Droplets,
  MapPin,
  Plane,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Zap,
} from 'lucide-react';
import ConsumerFooter from '@/components/landing/ConsumerFooter';
import AddressAutocomplete from '@/components/store/AddressAutocomplete';
import { Reveal, RevealGroup, RevealItem } from '@/components/ui/Reveal';
import { IV_SESSIONS } from '@/data/catalog';
import { ANALYTICS_EVENTS, trackConsented } from '@/lib/analytics';
import { COVERED_ZIPS, extractZip } from '@/lib/serviceArea';
import './homepage-v2.css';

const THERAPY_KEYS = ['hydration', 'myers', 'postnight'];

const THERAPY_PROMOTION = {
  hydration: { standard: 200, founder: 175 },
  myers: { standard: 285, founder: 195, badge: 'Most booked' },
  postnight: { standard: 285, founder: 195 },
};

const THERAPY_DETAIL_PATHS = {
  hydration: '/products/iv-vitamins/hydration-iv',
  myers: '/products/iv-vitamins/myers-cocktail-iv',
  postnight: '/products/iv-vitamins/post-night-out-iv',
};

const BENEFIT_COPY = {
  hydration: 'Fluids + electrolytes.',
  myers: 'Everyday vitamin blend.',
  postnight: 'After-night hydration.',
  immunity: 'Vitamin and mineral support for your routine.',
  energy: 'B vitamins and amino acids for demanding days.',
  jetlag: 'Hydration and wellness support around travel.',
};

const GOALS = [
  { id: 'hydration', label: 'Rehydrate', therapy: 'hydration', icon: Droplets },
  { id: 'recover', label: 'Recover', therapy: 'recovery', icon: RefreshCw },
  { id: 'immunity', label: 'Immune support', therapy: 'immunity', icon: ShieldCheck },
  { id: 'energy', label: 'Energy', therapy: 'energy', icon: Zap },
  { id: 'beauty', label: 'Skin and hair', therapy: 'beauty', icon: Sparkles },
  { id: 'travel', label: 'Travel reset', therapy: 'jetlag', icon: Plane },
];

const TIMINGS = [
  { id: 'today', label: 'Today', detail: 'The soonest available visit', icon: CalendarCheck },
  { id: 'tomorrow', label: 'Tomorrow', detail: 'Plan for the next day', icon: CalendarCheck },
  { id: 'week', label: 'This week', detail: 'Choose a flexible window', icon: CalendarCheck },
  { id: 'event', label: 'For an event', detail: 'Care for a group or venue', icon: Sparkles },
];

const PLACES = [
  { id: 'home', label: 'Home', detail: 'Care in your own space', icon: MapPin },
  { id: 'hotel', label: 'Hotel', detail: 'We meet you at your stay', icon: MapPin },
  { id: 'office', label: 'Office', detail: 'A workplace appointment', icon: MapPin },
  { id: 'other', label: 'Somewhere else', detail: 'Tell us during booking', icon: MapPin },
];

const PICKER_STEPS = ['Choose your focus', 'Tell us a little more', 'Explore the menu'];

const SERVICE_COUNTIES = [
  { id: 'san-francisco', label: 'San Francisco County', shortLabel: 'San Francisco', x: 29, y: 52, zoom: 1.85, cities: ['San Francisco'] },
  { id: 'contra-costa', label: 'Contra Costa County', shortLabel: 'Contra Costa', x: 72, y: 45, zoom: 1.6, cities: ['Antioch', 'Brentwood', 'Clayton', 'Concord', 'Danville', 'El Cerrito', 'Hercules', 'Lafayette', 'Martinez', 'Moraga', 'Oakley', 'Orinda', 'Pinole', 'Pittsburg', 'Pleasant Hill', 'Richmond', 'San Pablo', 'San Ramon', 'Walnut Creek'] },
  { id: 'alameda', label: 'Alameda County', shortLabel: 'Alameda', x: 67, y: 61, zoom: 1.65, cities: ['Alameda', 'Albany', 'Berkeley', 'Dublin', 'Emeryville', 'Fremont', 'Hayward', 'Livermore', 'Newark', 'Oakland', 'Piedmont', 'Pleasanton', 'San Leandro', 'Union City'] },
  { id: 'san-mateo', label: 'San Mateo County', shortLabel: 'San Mateo', x: 37, y: 69, zoom: 1.7, cities: ['Atherton', 'Belmont', 'Brisbane', 'Burlingame', 'Colma', 'Daly City', 'East Palo Alto', 'Foster City', 'Half Moon Bay', 'Hillsborough', 'Menlo Park', 'Millbrae', 'Pacifica', 'Portola Valley', 'Redwood City', 'San Bruno', 'San Carlos', 'San Mateo', 'South San Francisco', 'Woodside'] },
  { id: 'santa-clara', label: 'Santa Clara County', shortLabel: 'Santa Clara', x: 62, y: 83, zoom: 1.65, cities: ['Campbell', 'Cupertino', 'Gilroy', 'Los Altos', 'Los Altos Hills', 'Los Gatos', 'Milpitas', 'Monte Sereno', 'Morgan Hill', 'Mountain View', 'Palo Alto', 'San Jose', 'Santa Clara', 'Saratoga', 'Sunnyvale'] },
];

const SERVICE_MARKERS = [
  { id: 'san-francisco', label: 'San Francisco', countyId: 'san-francisco', aliases: ['san francisco', 'sf'] },
  { id: 'oakland', label: 'Oakland', countyId: 'alameda', aliases: ['oakland'] },
  { id: 'palo-alto', label: 'Palo Alto', countyId: 'santa-clara', aliases: ['palo alto', 'menlo park', 'redwood city'] },
  { id: 'san-jose', label: 'San Jose', countyId: 'santa-clara', aliases: ['san jose', 'sunnyvale', 'mountain view'] },
];

function countyById(id) {
  return SERVICE_COUNTIES.find((county) => county.id === id);
}

function countyForZip(zip) {
  if (zip.startsWith('941')) return countyById('san-francisco');
  if (['94530', '94547', '94549', '94556', '94563', '94596', '94597', '94598'].includes(zip)) return countyById('contra-costa');
  if (zip.startsWith('945') || zip.startsWith('946') || zip.startsWith('947')) return countyById('alameda');
  if (zip.startsWith('943') || ['94085', '94086', '94087', '94088', '94089'].includes(zip)) return countyById('santa-clara');
  if (zip.startsWith('940') || zip.startsWith('944')) return countyById('san-mateo');
  return null;
}

function countyForInput(normalized) {
  for (const county of SERVICE_COUNTIES) {
    const city = county.cities.find((name) => normalized.includes(name.toLowerCase()));
    if (city) return { county, city };
  }
  return null;
}

function checkCoverage(input) {
  const normalized = input.trim().toLowerCase();
  const namedMarker = SERVICE_MARKERS.find((marker) => marker.aliases.some((alias) => (
    normalized === alias || normalized.includes(`${alias},`) || normalized.includes(`${alias} `)
  )));
  const namedCountyMatch = countyForInput(normalized);
  const zip = extractZip(input);

  if (zip) {
    if (COVERED_ZIPS.has(zip)) {
      const county = namedCountyMatch?.county || (namedMarker ? countyById(namedMarker.countyId) : countyForZip(zip));
      if (!county) return { status: 'outside', marker: null, title: 'Coverage check needed.', zip };
      const place = namedCountyMatch?.city || namedMarker?.label || county.shortLabel;
      return { status: 'covered', marker: namedMarker || null, county, title: `Covered: ${place}.`, zip };
    }
    if (namedCountyMatch?.county.review || namedMarker?.review) {
      const county = namedCountyMatch?.county || countyById(namedMarker.countyId);
      return { status: 'review', marker: namedMarker || null, county, title: `${county.shortLabel} coverage is confirmed case by case.`, zip };
    }
    return { status: 'outside', marker: null, title: 'Coverage check needed.', zip };
  }

  if (namedCountyMatch || namedMarker) {
    const county = namedCountyMatch?.county || countyById(namedMarker.countyId);
    const place = namedCountyMatch?.city || namedMarker.label;
    return county.review
      ? { status: 'review', marker: namedMarker || null, county, title: `${county.shortLabel} coverage is confirmed case by case.` }
      : { status: 'covered', marker: namedMarker || null, county, title: `Covered: ${place}.` };
  }

  return { status: 'unknown', marker: null, title: 'Enter a city or ZIP.' };
}

const RESULT_COPY = {
  hydration: 'Hydration IV',
  recovery: 'Recovery IV',
  immunity: 'Immunity IV',
  energy: 'Energy IV',
  beauty: 'Beauty IV',
  jetlag: 'Jet Lag IV',
};

function useSectionView(section) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      trackConsented(ANALYTICS_EVENTS.SECTION_VIEWED, { section, page: 'homepage_v2' });
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [section]);

  return ref;
}

function SectionHeading({ eyebrow, title, body, id }) {
  return (
    <RevealGroup className="home-v2__heading" stagger={0.07}>
      <RevealItem as="p" className="home-v2__eyebrow">{eyebrow}</RevealItem>
      <RevealItem as="h2" id={id}>{title}</RevealItem>
      {body ? <RevealItem as="p" className="home-v2__intro">{body}</RevealItem> : null}
    </RevealGroup>
  );
}

function ResponsiveTitle({ desktop, mobile }) {
  return (
    <>
      <span className="home-v2__title-desktop">{desktop}</span>
      <span className="home-v2__title-mobile">{mobile}</span>
    </>
  );
}

function TherapyPreview() {
  const sectionRef = useSectionView('therapies');
  const therapies = useMemo(() => THERAPY_KEYS
    .map((key) => IV_SESSIONS.find((item) => item.key === key))
    .filter(Boolean), []);

  return (
    <section ref={sectionRef} className="home-v2__section home-v2__therapies" aria-labelledby="home-v2-therapies">
      <RevealGroup className="home-v2__menu-head" stagger={0.07}>
        <RevealItem as="p" className="home-v2__eyebrow">What we deliver</RevealItem>
        <RevealItem as="h2" id="home-v2-therapies">
          <ResponsiveTitle desktop="Explore therapies" mobile="Explore therapies" />
        </RevealItem>
        <RevealItem className="home-v2__menu-headrow">
          <ul className="home-v2__menu-trust" aria-label="Clinical standards">
            <li><ShieldCheck aria-hidden="true" />Licensed RNs</li>
            <li><Stethoscope aria-hidden="true" />Physician supervised</li>
            <li><ClipboardCheck aria-hidden="true" />Clinical review</li>
          </ul>
          <Link className="home-v2__menu-helper" to="/nurse-delivery?path=guided">
            Need help choosing? <ArrowRight aria-hidden="true" />
          </Link>
        </RevealItem>
        <RevealItem className="home-v2__founder-banner">
          <span>Grand opening</span>
          <p><strong>Founder pricing from $175.</strong> 30 days.</p>
        </RevealItem>
      </RevealGroup>
      <RevealGroup className="home-v2__therapy-grid" stagger={0.06}>
        {therapies.map((therapy) => {
          const Icon = therapy.icon;
          const promotion = THERAPY_PROMOTION[therapy.key];
          const bookingParams = new URLSearchParams({
            therapy: therapy.key,
            protocol: therapy.key,
            source: 'homepage-v2-menu',
          });
          return (
            <RevealItem key={therapy.key} as="article" className="home-v2__therapy-card">
              <div className="home-v2__therapy-visual" data-therapy={therapy.key}>
                <img src={therapy.image} alt={`${therapy.label} IV bag`} loading="lazy" decoding="async" />
                <span className="home-v2__therapy-icon" aria-hidden="true"><Icon /></span>
              </div>
              <div className="home-v2__therapy-body">
                <div className="home-v2__therapy-title-row">
                  <h3>{therapy.label}{promotion.badge ? <span>{promotion.badge}</span> : null}</h3>
                  <span className="home-v2__therapy-money">
                    <span><s>${promotion.standard}</s><strong>${promotion.founder}</strong></span>
                    <small>Per visit</small>
                  </span>
                </div>
                <p>{BENEFIT_COPY[therapy.key] || therapy.tagline}</p>
                <Link className="home-v2__therapy-details" to={THERAPY_DETAIL_PATHS[therapy.key]}>
                  Ingredients &amp; details
                </Link>
              </div>
              <span className="home-v2__therapy-money home-v2__therapy-money--mobile">
                <span><s>${promotion.standard}</s><strong>${promotion.founder}</strong></span>
                <small>{therapy.duration}</small>
              </span>
              <Link
                className="home-v2__therapy-cta"
                to={`/start?${bookingParams.toString()}`}
                onClick={() => trackConsented(ANALYTICS_EVENTS.START_CLICKED, { source: 'homepage_v2_menu', therapy: therapy.key })}
              >
                <span className="home-v2__therapy-cta-desktop">Book this visit</span>
                <span className="home-v2__therapy-cta-mobile">Book</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </RevealItem>
          );
        })}
      </RevealGroup>
      <Reveal className="home-v2__therapy-foot">
        <Link className="home-v2__section-link" to="/protocols">
          Full menu <ArrowRight aria-hidden="true" />
        </Link>
        <p>Clinical review required. $50 deposit applied.</p>
      </Reveal>
    </section>
  );
}

function GuidedPicker() {
  const sectionRef = useSectionView('guided_picker');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const options = step === 0 ? GOALS : step === 1 ? TIMINGS : PLACES;
  const prompt = step === 0
    ? 'What would you like to support?'
    : step === 1
      ? 'When would you like care?'
      : 'Where should we meet you?';
  const select = (option) => {
    const key = step === 0 ? 'goal' : step === 1 ? 'timing' : 'place';
    setAnswers((current) => ({ ...current, [key]: option.id }));
    setStep((current) => current + 1);
  };

  const reset = () => {
    setAnswers({});
    setStep(0);
  };

  const resultKey = answers.timing === 'event'
    ? 'event'
    : GOALS.find((goal) => goal.id === answers.goal)?.therapy || 'hydration';
  const resultSession = IV_SESSIONS.find((therapy) => therapy.key === resultKey);
  const resultPrice = resultSession?.price;
  const startParams = new URLSearchParams({
    therapy: resultKey,
    protocol: resultKey,
    source: 'homepage-v2',
    goal: answers.goal || '',
    timing: answers.timing || '',
    location: answers.place || '',
  });

  return (
    <section ref={sectionRef} className="home-v2__section home-v2__picker" aria-labelledby="home-v2-picker-title">
      <div className="home-v2__picker-copy">
        <p className="home-v2__eyebrow">Help me choose</p>
        <h2 id="home-v2-picker-title" aria-label="Find your starting point.">
          <ResponsiveTitle desktop="Find your starting point." mobile="Find your start." />
        </h2>
        <a className="home-v2__picker-help" href="sms:+14159807708">Talk to us <ArrowRight aria-hidden="true" /></a>
      </div>

      <div className="home-v2__picker-panel">
        <header className="home-v2__picker-panel-head">
          <span>Step {Math.min(step + 1, 3)} of 3</span>
          <small>{step < 3 ? PICKER_STEPS[step] : 'Your starting point'}</small>
          <div className="home-v2__picker-progress" aria-label={`Step ${Math.min(step + 1, 3)} of 3`}>
            {[0, 1, 2].map((dot) => <span key={dot} data-active={dot <= Math.min(step, 2)} />)}
          </div>
        </header>
        <div className="home-v2__picker-stage" aria-live="polite">
          {step < 3 ? (
            <div key={step} className="home-v2__picker-question">
              <div className="home-v2__picker-question-head">
                {step > 0 ? (
                  <button type="button" onClick={() => setStep((current) => current - 1)} aria-label="Back one question">
                    <ArrowLeft aria-hidden="true" />
                  </button>
                ) : null}
                <div><h3>{prompt}</h3></div>
              </div>
              <div className="home-v2__picker-options">
                {options.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button key={option.id} type="button" onClick={() => select(option)}>
                      <Icon aria-hidden="true" />
                      <span><strong>{option.label}</strong>{option.detail ? <small>{option.detail}</small> : null}</span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="home-v2__picker-result">
              <Sparkles aria-hidden="true" />
              <p>For your review</p>
              {resultKey === 'event' ? (
                <>
                  <h3>Event wellness</h3>
                  <span>Staffing built around your venue.</span>
                  <Link to="/events">Plan an event <ArrowRight aria-hidden="true" /></Link>
                </>
              ) : (
                <>
                  <h3>{RESULT_COPY[resultKey] || resultSession?.label}</h3>
                  <span>{resultPrice ? `From $${resultPrice}. ` : ''}Clinician-confirmed before dispatch.</span>
                  <Link
                    to={`/start?${startParams.toString()}`}
                    onClick={() => trackConsented(ANALYTICS_EVENTS.START_CLICKED, { source: 'homepage_v2_picker', therapy: resultKey })}
                  >
                    Start <ArrowRight aria-hidden="true" />
                  </Link>
                </>
              )}
              <button type="button" onClick={reset}>Start over</button>
            </div>
          )}
        </div>
        {step < 3 ? (
          <footer className="home-v2__picker-panel-foot">
            <Link to="/protocols">Browse all therapies <ArrowRight aria-hidden="true" /></Link>
          </footer>
        ) : null}
      </div>
    </section>
  );
}

function ServiceArea() {
  const sectionRef = useSectionView('service_area');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);

  const runCoverageCheck = (value = query) => {
    const nextResult = checkCoverage(value);
    setQuery(value);
    setResult(nextResult);
  };

  const chooseCounty = (county) => {
    setQuery(county.shortLabel);
    setResult({
      status: county.review ? 'review' : 'covered',
      marker: null,
      county,
      title: county.review
        ? `${county.shortLabel} coverage is confirmed case by case.`
        : county.label,
    });
  };
  const activeCounty = result?.county || null;
  const mapStyle = activeCounty ? {
    '--map-origin-x': `${activeCounty.x}%`,
    '--map-origin-y': `${activeCounty.y}%`,
    '--map-zoom': activeCounty.zoom,
  } : undefined;

  return (
    <section ref={sectionRef} className="home-v2__section home-v2__area" aria-labelledby="home-v2-area">
      <div className="home-v2__area-copy">
        <SectionHeading
          eyebrow="Where we go"
          title={(
            <ResponsiveTitle
              desktop={<>Bay Area care.<br />At your door.</>}
              mobile="Bay Area care."
            />
          )}
          body="Five Bay Area counties."
          id="home-v2-area"
        />
        <p className="home-v2__area-hours"><Clock3 aria-hidden="true" /><strong>Daily · 8 AM–8 PM</strong></p>
        <form className="home-v2__coverage-form" onSubmit={(event) => { event.preventDefault(); runCoverageCheck(); }}>
          <label htmlFor="home-v2-coverage">Address or ZIP</label>
          <div>
            <span>
              <MapPin aria-hidden="true" />
              <AddressAutocomplete
                id="home-v2-coverage"
                value={query}
                onChange={setQuery}
                onSelect={(address) => runCoverageCheck(address.label || [address.street, address.city, address.state, address.zip].filter(Boolean).join(', '))}
                className="home-v2__coverage-input"
                placeholder="Start typing"
                autoComplete="street-address"
                minChars={4}
                debounceMs={180}
              />
            </span>
            <button type="submit">Check <ArrowRight aria-hidden="true" /></button>
          </div>
        </form>
        <div className="home-v2__coverage-result" data-status={result?.status || 'idle'} aria-live="polite">
          {result ? (
            <>
              <strong>{result.title}</strong>
              {result.status === 'covered'
                ? <Link to="/start?source=homepage-service-area">Start a visit <ArrowRight aria-hidden="true" /></Link>
                : <a href="sms:+14159807708">Text us <ArrowRight aria-hidden="true" /></a>}
            </>
          ) : null}
        </div>
        <p className="home-v2__area-outside">Outside the region? <a href="sms:+14159807708">Text us <ArrowRight aria-hidden="true" /></a></p>
      </div>

      <Reveal className="home-v2__area-map">
        <header><strong>Service counties</strong><Compass aria-label="North" /></header>
        <div className="home-v2__map-viewport" data-zoomed={Boolean(activeCounty)} style={mapStyle}>
          <img src="/images/bay-area-service-map.png" alt="Bay Area service map" loading="lazy" decoding="async" />
          <div className="home-v2__map-markers" aria-label="Bay Area counties">
            {SERVICE_COUNTIES.map((county) => (
              <button
                key={county.id}
                type="button"
                style={{ left: `${county.x}%`, top: `${county.y}%` }}
                onClick={() => chooseCounty(county)}
                aria-label={`Explore ${county.label}`}
              >
                <span>{county.shortLabel}</span>
              </button>
            ))}
          </div>
          {activeCounty ? (
            <div key={activeCounty.id} className="home-v2__map-focus">
              <button type="button" onClick={() => setResult(null)}><ArrowLeft aria-hidden="true" />All counties</button>
              <strong>{activeCounty.label}</strong>
              <p>{activeCounty.cities.join(' · ')}</p>
              <small>{activeCounty.review ? 'Case-by-case coverage.' : 'Timing varies by address.'}</small>
            </div>
          ) : null}
        </div>
        <footer><span><i />Five counties</span></footer>
      </Reveal>
    </section>
  );
}

function ClosingActions() {
  const sectionRef = useSectionView('closing_actions');
  return (
    <section ref={sectionRef} className="home-v2__closing" aria-label="Start an Avalon visit or plan an event">
      <Link className="home-v2__events-link" to="/events">
        <span><small>Groups and venues</small><strong>Nurses for your event.</strong></span>
        <ArrowRight aria-hidden="true" />
      </Link>
      <div className="home-v2__final-cta">
        <p>Ready when you are.</p>
        <h2><ResponsiveTitle desktop="Care comes to you." mobile="Care comes to you." /></h2>
        <Link
          to="/start"
          onClick={() => trackConsented(ANALYTICS_EVENTS.START_CLICKED, { source: 'homepage_v2_final' })}
        >
          <span><strong>Start</strong><small>Under a minute. $50 deposit applied.</small></span>
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export default function HomepageV2() {
  return (
    <div className="home-v2">
      <TherapyPreview />
      <GuidedPicker />
      <ServiceArea />
      <ClosingActions />
      <ConsumerFooter />
    </div>
  );
}
