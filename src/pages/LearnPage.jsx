import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, BookOpen, CheckCircle, ShieldCheck } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import MedicalReviewNote from '@/components/seo/MedicalReviewNote';
import { useSeo } from '@/lib/seo';
import NotFound from '@/pages/NotFound';
import {
  LOCAL_BUSINESS_PROFILE,
  MEDICAL_REVIEW,
  SEO_BASE_URL,
  educationArticles,
  educationClusters,
  getArticleBySlug,
  getPillarBySlug,
  indexedEducationArticles,
} from '@/data/seoArchitecture';

function TextLink({ to, children }) {
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

export function LearnHub() {
  useSeo({
    title: 'Mobile IV Therapy Education | Avalon Vitality',
    description: 'Educational guides for mobile IV therapy, NAD+, recovery therapy, event recovery, hotel service, and Bay Area location planning.',
    path: '/learn',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Avalon Vitality Education',
      url: `${SEO_BASE_URL}/learn`,
      hasPart: indexedEducationArticles.map((item) => ({ '@type': 'Article', name: item.h1, url: `${SEO_BASE_URL}${item.path}` })),
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="px-5 pb-16 pt-32 md:px-12 lg:px-20">
        <div className="mx-auto max-w-6xl">
          <h1 className="mt-5 max-w-4xl font-heading text-6xl uppercase leading-[0.88] tracking-tight text-foreground md:text-8xl">
            Mobile Recovery Guides
          </h1>
          <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-foreground/62 md:text-lg">
            Useful, compliance-aware guides that support Avalon service pages without unsafe medical claims.
          </p>

          <div className="mt-12 space-y-10">
            {educationClusters.map((cluster) => {
              const articles = educationArticles.filter((item) => item.cluster === cluster);
              return (
                <section key={cluster}>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="font-heading text-3xl uppercase leading-none text-foreground">{cluster}</h2>
                    {articles.some((item) => item.noindex) && (
                      <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.06] px-3 py-1 font-body text-[9px] uppercase tracking-[0.14em] text-amber-100/70">
                        Approval gated
                      </span>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {articles.map((item) => (
                      <Link
                        key={item.slug}
                        to={item.path}
                        className="group rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5 transition-colors hover:border-foreground/24 hover:bg-foreground/[0.055]"
                      >
                        <p className="font-body text-[9px] uppercase tracking-[0.24em] text-foreground/35">{item.noindex ? 'Noindex' : item.cluster}</p>
                        <h3 className="mt-3 font-heading text-2xl uppercase leading-none text-foreground">{item.h1}</h3>
                        <p className="mt-4 line-clamp-3 font-body text-sm leading-relaxed text-foreground/55">{item.description}</p>
                        <span className="mt-5 inline-flex items-center gap-2 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55 group-hover:text-foreground">
                          Read guide <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function LearnPage() {
  const { slug } = useParams();
  const article = getArticleBySlug(slug);
  const robots = article?.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';

  useSeo({
    title: article?.title || 'Guide Not Found | Avalon Vitality',
    description: article?.description || 'Avalon Vitality education guide not found.',
    path: article?.path || `/learn/${slug || ''}`,
    robots,
    jsonLd: article ? {
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
          '@id': `${SEO_BASE_URL}${article.path}#webpage`,
          url: `${SEO_BASE_URL}${article.path}`,
          name: article.h1,
          description: article.description,
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
          '@id': `${SEO_BASE_URL}${article.path}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SEO_BASE_URL}/` },
            { '@type': 'ListItem', position: 2, name: 'Learn', item: `${SEO_BASE_URL}/learn` },
            { '@type': 'ListItem', position: 3, name: article.h1, item: `${SEO_BASE_URL}${article.path}` },
          ],
        },
        {
          '@type': 'Article',
          '@id': `${SEO_BASE_URL}${article.path}#article`,
          headline: article.h1,
          description: article.description,
          url: `${SEO_BASE_URL}${article.path}`,
          author: { '@type': 'Organization', name: 'Avalon Vitality' },
          publisher: { '@id': `${SEO_BASE_URL}/#localbusiness` },
          reviewedBy: {
            '@type': 'Person',
            name: MEDICAL_REVIEW.reviewerName,
            jobTitle: MEDICAL_REVIEW.reviewerTitle,
          },
          dateModified: MEDICAL_REVIEW.reviewedDate,
          mainEntityOfPage: `${SEO_BASE_URL}${article.path}#webpage`,
        },
      ],
    } : null,
  });

  if (!article) return <NotFound />;

  const relatedPillars = article.relatedPillars.map(getPillarBySlug).filter(Boolean);
  const sameCluster = educationArticles.filter((item) => item.cluster === article.cluster && item.slug !== article.slug).slice(0, 5);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="pt-28">
        <article>
          <header className="px-5 pb-14 pt-10 md:px-12 md:pb-20 lg:px-20">
            <div className="mx-auto max-w-4xl">
              <h1 className="mt-5 font-heading text-5xl uppercase leading-[0.9] tracking-tight text-foreground md:text-7xl">
                {article.h1}
              </h1>
              <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-foreground/62 md:text-lg">
                {article.description}
              </p>
              <MedicalReviewNote className="mt-6 max-w-2xl" />
              {article.noindex && (
                <div className="mt-6 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 font-body text-sm leading-relaxed text-amber-100/78">
                  This guide is noindex and approval-gated until Avalon clinical leadership and legal counsel approve public CBD IV language.
                </div>
              )}
            </div>
          </header>

          <section className="border-t border-foreground/[0.07] px-5 py-12 md:px-12 md:py-16 lg:px-20">
            <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3">
              {article.points.map((point) => (
                <div key={point} className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-5">
                  <CheckCircle className="h-5 w-5 text-accent" strokeWidth={1.7} />
                  <p className="mt-4 font-body text-sm leading-relaxed text-foreground/60">{point}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border-t border-foreground/[0.07] px-5 py-12 md:px-12 md:py-16 lg:px-20">
            <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-[220px_1fr]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-foreground/[0.10] bg-foreground/[0.03]">
                <BookOpen className="h-5 w-5 text-foreground/45" strokeWidth={1.6} />
              </div>
              <div className="space-y-6 font-body text-base leading-relaxed text-foreground/62">
                <p>
                  Avalon writes education pages to help clients understand the mobile workflow before they book. The practical sequence is request, intake, consent, clinical review, appointment confirmation, registered nurse arrival, visit closeout, and follow-up when needed.
                </p>
                <p>
                  Mobile service does not remove clinical responsibility. IV-related services are subject to eligibility, location, nurse availability, supply readiness, and clinical approval. The care team may adjust the protocol or decline service when a mobile appointment is not appropriate.
                </p>
                <p>
                  Use this guide as planning context, not personal medical advice. Clients with urgent symptoms, unstable conditions, or emergency concerns should seek appropriate medical care instead of booking a wellness appointment.
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-foreground/[0.07] px-5 py-12 md:px-12 md:py-16 lg:px-20">
            <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-foreground/42" strokeWidth={1.6} />
                  <p className="font-body text-[9px] uppercase tracking-[0.24em] text-foreground/36">Related service pages</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {relatedPillars.map((item) => <TextLink key={item.slug} to={item.path}>{item.h1}</TextLink>)}
                </div>
              </div>
              <div>
                <p className="mb-4 font-body text-[9px] uppercase tracking-[0.24em] text-foreground/36">More in {article.cluster}</p>
                <div className="flex flex-wrap gap-2">
                  {sameCluster.map((item) => <TextLink key={item.slug} to={item.path}>{item.h1}</TextLink>)}
                </div>
              </div>
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
}
