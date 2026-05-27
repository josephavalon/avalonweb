import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Building2, Calendar, Hotel, MapPin, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import MedicalReviewNote from '@/components/seo/MedicalReviewNote';
import { useSeo } from '@/lib/seo';
import NotFound from '@/pages/NotFound';
import {
  CLINICAL_STANDARD,
  LOCAL_BUSINESS_PROFILE,
  MEDICAL_REVIEW,
  SEO_BASE_URL,
  getLocationBySlug,
  getPillarBySlug,
  locationPages,
} from '@/data/seoArchitecture';

const locationServices = [
  { icon: MapPin, title: 'Mobile Appointments', body: 'Home, hotel, office, and launch appointments can be reviewed for eligible addresses.' },
  { icon: ShieldCheck, title: 'IV Therapy', body: 'IV hydration support and selected protocols are clinician-reviewed before RN dispatch.' },
  { icon: Calendar, title: 'NAD+ Review', body: 'NAD+ appointment requests are reviewed for eligibility, visit length, and service setting.' },
  { icon: Hotel, title: 'Hotel Service', body: 'Avalon can support concierge and VIP hotel requests when location and clinical review align.' },
  { icon: Building2, title: 'Launches', body: 'Private launches, corporate programs, and recovery lounges can be planned in advance.' },
];

function RouteLink({ to, children }) {
  return (
    <Link
      to={to}
      className="group inline-flex min-h-[42px] items-center gap-3 rounded-full border border-foreground/12 bg-foreground/[0.03] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62 transition-colors hover:border-foreground/35 hover:text-foreground"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
    </Link>
  );
}

export function LocationsHub() {
  useSeo({
    title: 'Bay Area Mobile IV Therapy Locations | Avalon Vitality',
    description: 'Explore Avalon Vitality mobile recovery protocols, IV therapy, NAD+, recovery support, hotel service, launch service, and mobile appointment locations across the Bay Area.',
    path: '/locations',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Avalon Vitality Locations',
      url: `${SEO_BASE_URL}/locations`,
      hasPart: locationPages.map((item) => ({ '@type': 'WebPage', name: item.h1, url: `${SEO_BASE_URL}${item.path}` })),
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="px-5 pb-16 pt-32 md:px-12 lg:px-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-body text-[10px] uppercase tracking-[0.34em] text-foreground/42">Bay Area Locations</p>
          <h1 className="mt-5 max-w-4xl font-heading text-6xl uppercase leading-[0.88] tracking-tight text-foreground md:text-8xl">
            Mobile Recovery Across the Bay
          </h1>
          <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-foreground/62 md:text-lg">
            City-specific recovery pages for homes, hotels, offices, launches, and private events across the Bay Area.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {['San Francisco', 'Peninsula', 'South Bay', 'East Bay', 'North Bay', 'Wine Country'].map((item) => (
              <span key={item} className="rounded-full border border-foreground/10 bg-foreground/[0.025] px-3 py-2 font-body text-[10px] uppercase tracking-[0.14em] text-foreground/45">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locationPages.map((item) => (
              <Link
                key={item.slug}
                to={item.path}
                className="group rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5 transition-colors hover:border-foreground/24 hover:bg-foreground/[0.055]"
              >
                <p className="font-body text-[9px] uppercase tracking-[0.24em] text-foreground/35">{item.region}</p>
                <h2 className="mt-3 font-heading text-3xl uppercase leading-none text-foreground">{item.city}</h2>
                <p className="mt-4 line-clamp-3 font-body text-sm leading-relaxed text-foreground/55">{item.communityRecovery}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.neighborhoods.slice(0, 3).map((neighborhood) => (
                    <span key={neighborhood} className="rounded-full border border-foreground/10 px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.12em] text-foreground/38">
                      {neighborhood}
                    </span>
                  ))}
                </div>
                <span className="mt-5 inline-flex items-center gap-2 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55 group-hover:text-foreground">
                  Open market <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function LocationPage() {
  const { slug } = useParams();
  const page = getLocationBySlug(slug);

  useSeo({
    title: page?.title || 'Location Not Found | Avalon Vitality',
    description: page?.description || 'Avalon Vitality location page not found.',
    path: page?.path || `/locations/${slug || ''}`,
    jsonLd: page ? {
      '@context': 'https://schema.org',
      '@graph': [
        {
          ...LOCAL_BUSINESS_PROFILE,
          url: `${SEO_BASE_URL}/`,
        },
        {
          '@type': 'WebSite',
          '@id': `${SEO_BASE_URL}/#website`,
          name: 'Avalon Vitality',
          url: `${SEO_BASE_URL}/`,
          publisher: { '@id': `${SEO_BASE_URL}/#localbusiness` },
        },
        {
          '@type': 'WebPage',
          '@id': `${SEO_BASE_URL}${page.path}#webpage`,
          url: `${SEO_BASE_URL}${page.path}`,
          name: page.h1,
          description: page.description,
          reviewedBy: {
            '@type': 'Person',
            name: MEDICAL_REVIEW.reviewerName,
            jobTitle: MEDICAL_REVIEW.reviewerTitle,
          },
          dateModified: MEDICAL_REVIEW.reviewedDate,
          lastReviewed: MEDICAL_REVIEW.reviewedDate,
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${SEO_BASE_URL}${page.path}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SEO_BASE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Locations', item: `${SEO_BASE_URL}/locations` },
            { '@type': 'ListItem', position: 3, name: page.h1, item: `${SEO_BASE_URL}${page.path}` },
          ],
        },
        {
          '@type': 'Service',
          '@id': `${SEO_BASE_URL}${page.path}#service`,
          name: page.h1,
          serviceType: 'Mobile IV therapy and recovery support',
          areaServed: { '@type': 'City', name: page.city },
          provider: { '@id': `${SEO_BASE_URL}/#localbusiness` },
        },
      ],
    } : null,
  });

  if (!page) return <NotFound />;

  const relatedPillars = page.relatedPillars.map(getPillarBySlug).filter(Boolean);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-28">
        <section className="px-5 pb-14 pt-10 md:px-12 md:pb-20 lg:px-20">
          <div className="mx-auto max-w-6xl">
            <p className="font-body text-[10px] uppercase tracking-[0.34em] text-foreground/42">{page.region}</p>
            <h1 className="mt-5 max-w-4xl font-heading text-6xl uppercase leading-[0.88] tracking-tight text-foreground md:text-8xl">
              {page.h1}
            </h1>
            <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-foreground/62 md:text-lg">
              {page.intro}
            </p>
            <MedicalReviewNote className="mt-6 max-w-2xl" />
            <div className="mt-8 flex flex-wrap gap-3">
              <RouteLink to="/book">Request appointment</RouteLink>
              <RouteLink to="/service-area">Check service area</RouteLink>
            </div>
          </div>
        </section>

        <section className="border-t border-foreground/[0.07] px-5 py-12 md:px-12 md:py-16 lg:px-20">
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.34em] text-foreground/38">Community Recovery</p>
              <h2 className="mt-4 max-w-lg font-heading text-5xl uppercase leading-none text-foreground md:text-6xl">
                Built for {page.city}
              </h2>
            </div>
            <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5 md:p-6">
              <p className="font-body text-base leading-relaxed text-foreground/62">
                {page.communityRecovery}
              </p>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {page.localUseCases.map((item) => (
                  <div key={item} className="rounded-xl border border-foreground/[0.08] bg-background/35 p-4">
                    <p className="font-body text-[10px] uppercase tracking-[0.16em] text-foreground/58">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-foreground/[0.07] px-5 py-12 md:px-12 md:py-16 lg:px-20">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-5">
            {locationServices.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-4">
                <Icon className="h-5 w-5 text-foreground/45" strokeWidth={1.6} />
                <h2 className="mt-4 font-heading text-xl uppercase leading-none text-foreground">{title}</h2>
                <p className="mt-3 font-body text-xs leading-relaxed text-foreground/50">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-foreground/[0.07] px-5 py-12 md:px-12 md:py-16 lg:px-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.34em] text-foreground/38">Local Availability</p>
              <h2 className="mt-4 font-heading text-5xl uppercase leading-none text-foreground md:text-6xl">
                Services in {page.city}
              </h2>
              <p className="mt-5 max-w-md font-body text-sm leading-relaxed text-foreground/56">
                Avalon can review requests for IV therapy, NAD+, recovery therapy, hotel service, launch service, and mobile appointments in this market. Final service depends on clinical eligibility and scheduling coverage.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-3 font-body text-[9px] uppercase tracking-[0.24em] text-foreground/36">Neighborhoods and nearby areas</p>
                <div className="flex flex-wrap gap-2">
                  {page.neighborhoods.map((item) => (
                    <span key={item} className="rounded-full border border-foreground/10 bg-foreground/[0.025] px-3 py-2 font-body text-[10px] uppercase tracking-[0.14em] text-foreground/52">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              {page.zipExamples?.length > 0 && (
                <div>
                  <p className="mb-3 font-body text-[9px] uppercase tracking-[0.24em] text-foreground/36">ZIP-aware coverage check</p>
                  <div className="flex flex-wrap gap-2">
                    {page.zipExamples.map((item) => (
                      <span key={item} className="rounded-full border border-foreground/10 bg-foreground/[0.025] px-3 py-2 font-body text-[10px] uppercase tracking-[0.14em] text-foreground/52">
                        {item}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 font-body text-xs leading-relaxed text-foreground/48">
                    ZIP examples help route local availability. Final nurse coverage, ETA, and protocol eligibility are confirmed before dispatch.
                  </p>
                </div>
              )}
              <div>
                <p className="mb-3 font-body text-[9px] uppercase tracking-[0.24em] text-foreground/36">Clinical standard</p>
                <div className="space-y-2">
                  {CLINICAL_STANDARD.map((item) => (
                    <p key={item} className="font-body text-xs leading-relaxed text-foreground/55">{item}</p>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <p className="mb-3 font-body text-[9px] uppercase tracking-[0.24em] text-foreground/36">Related service pages</p>
                <div className="flex flex-wrap gap-2">
                  {relatedPillars.map((item) => <RouteLink key={item.slug} to={item.path}>{item.h1}</RouteLink>)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-foreground/[0.07] px-5 py-10 md:px-12 lg:px-20">
          <div className="mx-auto max-w-6xl rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-5">
            <p className="font-body text-[11px] leading-relaxed text-foreground/48">
              Avalon location pages describe mobile wellness availability only. Services are not emergency care. Appointment timing, nurse assignment, and protocols are subject to clinical approval, staff coverage, supplies, and operational feasibility.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
