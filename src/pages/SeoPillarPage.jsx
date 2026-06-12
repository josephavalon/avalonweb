import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
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
  getArticleBySlug,
  getLocationBySlug,
  getPillarByPath,
  indexedServicePillars,
} from '@/data/seoArchitecture';

function MiniLink({ to, children }) {
  return (
    <Link
      to={to}
      className="group inline-flex min-h-[42px] items-center justify-between gap-3 rounded-full border border-foreground/12 bg-foreground/[0.03] px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/62 transition-colors hover:border-foreground/35 hover:text-foreground"
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
    </Link>
  );
}

function InfoCard({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5 backdrop-blur-xl">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-foreground/[0.10] bg-background/40 text-foreground/58">
        <Icon className="h-4 w-4" strokeWidth={1.7} />
      </div>
      <h2 className="font-heading text-2xl uppercase leading-none text-foreground">{title}</h2>
      <div className="mt-4 space-y-2 font-body text-sm leading-relaxed text-foreground/58">{children}</div>
    </div>
  );
}

export default function SeoPillarPage() {
  const { pathname } = useLocation();
  const page = getPillarByPath(pathname);
  const robots = page?.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';

  useSeo({
    title: page?.title || 'Page Not Found | Avalon Vitality',
    description: page?.description || 'Avalon Vitality page not found.',
    path: page?.path || pathname,
    robots,
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
          isPartOf: { '@id': `${SEO_BASE_URL}/#website` },
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
            { '@type': 'ListItem', position: 2, name: page.h1, item: `${SEO_BASE_URL}${page.path}` },
          ],
        },
        ...(!page.noindex ? [{
          '@type': 'Service',
          '@id': `${SEO_BASE_URL}${page.path}#service`,
          name: page.h1,
          serviceType: page.eyebrow,
          provider: { '@id': `${SEO_BASE_URL}/#localbusiness` },
          areaServed: { '@type': 'AdministrativeArea', name: 'San Francisco Bay Area' },
        }] : []),
      ],
    } : null,
  });

  if (!page) return <NotFound />;

  const relatedLocations = page.relatedLocations.map(getLocationBySlug).filter(Boolean);
  const relatedArticles = page.relatedArticles.map(getArticleBySlug).filter(Boolean);
  const relatedPillars = indexedServicePillars.filter((item) => item.slug !== page.slug).slice(0, 5);

  return (
    <div className="av-page-surface min-h-screen text-foreground">
      <Navbar />
      <main className="pt-28">
        <section className="px-5 pb-16 pt-10 md:px-12 md:pb-24 lg:px-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <h1 className="mt-5 max-w-4xl font-heading text-6xl uppercase leading-[0.88] tracking-tight text-foreground md:text-8xl">
                {page.h1}
              </h1>
              <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-foreground/62 md:text-lg">
                {page.intro}
              </p>
              {page.approvalNote && (
                <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 font-body text-sm leading-relaxed text-amber-100/78">
                  {page.approvalNote}
                </div>
              )}
              <MedicalReviewNote className="mt-6 max-w-2xl" />
              <div className="mt-8 flex flex-wrap gap-3">
                <MiniLink to="/book">Request appointment</MiniLink>
                <MiniLink to="/service-area">Check coverage</MiniLink>
              </div>
            </div>

            <div className="rounded-3xl border border-foreground/[0.10] bg-foreground/[0.035] p-5 shadow-[0_24px_80px_hsl(var(--foreground)/0.08)] backdrop-blur-xl">
              <p className="font-body text-[9px] uppercase tracking-[0.26em] text-foreground/38">Clinical Standard</p>
              <div className="mt-4 space-y-3">
                {CLINICAL_STANDARD.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={1.8} />
                    <p className="font-body text-sm leading-relaxed text-foreground/62">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-foreground/[0.07] px-5 py-12 md:px-12 md:py-16 lg:px-20">
          <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
            <InfoCard icon={Sparkles} title="Available For">
              {page.services.map((item) => <p key={item}>{item}</p>)}
            </InfoCard>
            <InfoCard icon={ShieldCheck} title="Care Model">
              <p>Avalon does not position mobile IV service as emergency care or disease treatment.</p>
              <p>Services support hydration, recovery, and wellness when the clinical team confirms eligibility.</p>
              <p>New clients may require a Good Faith Exam before dispatch.</p>
            </InfoCard>
            <InfoCard icon={MapPin} title="Bay Area Fit">
              <p>{page.angle}</p>
              <p>Appointment availability depends on location, schedule, staff coverage, and clinical approval.</p>
            </InfoCard>
          </div>
        </section>

        <section className="border-t border-foreground/[0.07] px-5 py-12 md:px-12 md:py-16 lg:px-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="mt-4 font-heading text-5xl uppercase leading-none text-foreground md:text-6xl">
                Connected Pages
              </h2>
              <p className="mt-5 max-w-md font-body text-sm leading-relaxed text-foreground/56">
                This page links into Avalon location pages and education guides so clients can understand the service, the clinical workflow, and local availability before booking.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-3 font-body text-[9px] uppercase tracking-[0.24em] text-foreground/36">Locations</p>
                <div className="flex flex-wrap gap-2">
                  {relatedLocations.map((item) => <MiniLink key={item.slug} to={item.path}>{item.city}</MiniLink>)}
                  {!relatedLocations.length && <p className="font-body text-sm text-foreground/45">Location links are held until this service is approved.</p>}
                </div>
              </div>
              <div>
                <p className="mb-3 font-body text-[9px] uppercase tracking-[0.24em] text-foreground/36">Education</p>
                <div className="flex flex-wrap gap-2">
                  {relatedArticles.map((item) => <MiniLink key={item.slug} to={item.path}>{item.h1}</MiniLink>)}
                </div>
              </div>
              <div className="md:col-span-2">
                <p className="mb-3 font-body text-[9px] uppercase tracking-[0.24em] text-foreground/36">Related Service Pages</p>
                <div className="flex flex-wrap gap-2">
                  {relatedPillars.map((item) => <MiniLink key={item.slug} to={item.path}>{item.h1}</MiniLink>)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-foreground/[0.07] px-5 py-10 md:px-12 lg:px-20">
          <div className="mx-auto max-w-6xl rounded-2xl border border-foreground/[0.08] bg-foreground/[0.025] p-5">
            <p className="font-body text-[11px] leading-relaxed text-foreground/48">
              Compliance note: Avalon content is for general wellness education only. Services are not emergency care or a substitute for medical advice. IV-related appointments require intake, consent, and clinical review. Final availability depends on clinical eligibility and operational coverage.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
