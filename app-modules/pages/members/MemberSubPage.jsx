import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { useSeo } from '@/lib/seo';
import { applyTheme } from '@/lib/theme';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import MemberSectionNav, { MEMBER_SECTIONS } from './MemberSectionNav.jsx';

// Shared layout for "coming soon" member sub-pages (Bookings, Memberships,
// Billing, Documents). Keeps the dashboard's dark/glass language and exposes
// the cross-section nav strip so members can hop between areas.
export default function MemberSubPage({ eyebrow, title, description, ctaLabel, ctaTo, seoPath }) {
  const location = useLocation();

  useSeo({
    title: `${title} - Avalon Vitality`,
    description,
    path: seoPath || location.pathname,
  });

  useEffect(() => { try { applyTheme(); } catch { /* noop */ } }, []);

  const isExternal = ctaTo && (ctaTo.startsWith('http') || ctaTo.startsWith('mailto:'));

  return (
    <main className="av-page-surface min-h-dvh pb-[calc(7.5rem+env(safe-area-inset-bottom))] font-body text-foreground">
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/86 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <Link to="/members/dashboard" className="inline-flex items-center gap-2 font-body text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/72 transition-colors hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} /> Dashboard
          </Link>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/34">{eyebrow}</p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 pt-6">
        <MemberSectionNav />
      </div>

      <section className="mx-auto mt-6 w-full max-w-5xl px-4">
        <div className="rounded-[1.75rem] border border-foreground/[0.10] bg-foreground/[0.045] p-6 shadow-[0_28px_80px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl sm:p-10">
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/45">{eyebrow}</p>
          <h1 className="mt-3 font-heading text-[2.4rem] uppercase leading-[0.92] tracking-tight text-foreground sm:text-[3.2rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-xl font-body text-sm leading-relaxed text-foreground/62">
            {description}
          </p>

          <div className="mt-8 inline-flex flex-wrap gap-2">
            {ctaLabel && ctaTo && (isExternal ? (
              <a
                href={ctaTo}
                className="inline-flex min-h-[52px] items-center gap-3 rounded-full bg-foreground px-6 font-body text-xs font-bold uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/88"
              >
                {ctaLabel} <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </a>
            ) : (
              <Link
                to={ctaTo}
                className="inline-flex min-h-[52px] items-center gap-3 rounded-full bg-foreground px-6 font-body text-xs font-bold uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/88"
              >
                {ctaLabel} <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
            ))}
            <Link
              to="/members/messages"
              className="inline-flex min-h-[52px] items-center gap-3 rounded-full border border-foreground/[0.16] bg-foreground/[0.045] px-6 font-body text-xs font-bold uppercase tracking-[0.2em] text-foreground/72 transition-colors hover:text-foreground"
            >
              Message your nurse
            </Link>
          </div>

          <p className="mt-8 font-body text-xs leading-relaxed text-foreground/45">
            Your records will populate this view automatically as visits, plans, and documents are added to your file.
          </p>
        </div>
      </section>

      <MemberBottomNav />
    </main>
  );
}

export { MEMBER_SECTIONS };
