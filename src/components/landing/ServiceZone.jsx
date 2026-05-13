import React from 'react';

const NEIGHBORHOODS = [
  'SoMa', 'Financial District', 'Union Square', 'Nob Hill', 'Russian Hill',
  'Pacific Heights', 'Marina', 'Cow Hollow', 'Hayes Valley', 'Mission District',
  'Castro', 'Noe Valley', 'Bernal Heights', 'Potrero Hill', 'Mission Bay',
  'Dogpatch', 'Embarcadero', 'Chinatown', 'North Beach', "Fisherman's Wharf",
  'Presidio', 'Sunset District', 'Richmond District', 'Inner Sunset', 'Cole Valley',
  'Twin Peaks', 'Glen Park', 'West Portal', 'Palo Alto', 'Menlo Park',
  'Burlingame', 'San Mateo', 'Redwood City', 'Mountain View', 'Sunnyvale',
  'Cupertino', 'Los Gatos', 'Saratoga', 'Campbell', 'Santa Clara',
  'San Jose (downtown)',
];

export default function ServiceZone() {
  return (
    <section
      aria-label="Service area"
      className="py-10 md:py-14 px-5 md:px-12 lg:px-20 border-t border-foreground/[0.06]"
    >
      <div className="max-w-5xl mx-auto">
        <p className="font-body text-[10px] tracking-[0.35em] uppercase text-foreground/40 mb-3">
          Service Area
        </p>
        <h2 className="font-heading text-4xl md:text-6xl text-foreground uppercase leading-none mb-4">
          We Come to You
        </h2>
        <p className="font-body text-sm text-foreground/55 mb-5 max-w-xl">
          Serving San Francisco and the Peninsula. More Bay Area coverage coming soon.
        </p>

        {/* All neighborhood names in a single paragraph — full SEO coverage, minimal DOM */}
        <p className="font-body text-xs text-foreground/40 leading-relaxed">
          {NEIGHBORHOODS.join(' · ')}
        </p>

        <p className="font-body text-[11px] text-foreground/30 mt-4">
          Not seeing your neighborhood?{' '}
          <a
            href="mailto:hello@avalonvitality.co"
            className="underline underline-offset-2 hover:text-foreground/55 transition-colors"
          >
            Email us
          </a>{' '}
          — we may still be able to accommodate you.
        </p>
      </div>
    </section>
  );
}
