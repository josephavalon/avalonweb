import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Stethoscope } from 'lucide-react';
import { useSeo } from '@/lib/seo';
import { applyTheme } from '@/lib/theme';

export default function Nurses() {
  useSeo({
    title: 'Nurse Portal - Avalon Vitality',
    description: 'The Avalon Vitality nurse portal is coming soon.',
    path: '/nurses',
    robots: 'noindex, nofollow',
  });

  useEffect(() => { try { applyTheme(); } catch { /* noop */ } }, []);

  return (
    <div className="av-page-surface relative min-h-screen min-h-dvh overflow-hidden px-4 py-4 text-foreground md:px-8 md:py-8">
      <div className="pointer-events-none fixed inset-0 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,hsl(var(--foreground)/0.10),transparent_30%),linear-gradient(180deg,hsl(var(--foreground)/0.035),transparent_42%)]" />
      </div>

      <main className="relative mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-5xl place-items-center">
        <section className="w-full max-w-[440px] rounded-[2rem] border border-foreground/[0.12] bg-foreground/[0.045] p-7 text-center shadow-[0_28px_120px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl sm:p-9">
          <span className="mx-auto mb-7 inline-flex h-14 w-14 items-center justify-center rounded-full border border-foreground/[0.12] bg-foreground/[0.045] text-foreground/72">
            <Stethoscope className="h-6 w-6" strokeWidth={1.8} />
          </span>

          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.32em] text-foreground/55">
            Nurse Portal
          </p>
          <h1 className="mt-3 font-heading text-[3.15rem] uppercase leading-[0.86] tracking-tight text-foreground sm:text-[4rem]">
            Coming<br />Soon
          </h1>
          <p className="mx-auto mt-4 max-w-[28ch] font-body text-sm font-medium leading-relaxed text-foreground/55">
            The Avalon Vitality nurse portal is on the way. Registered nurses will manage
            visits, kits, and clinical reviews from here.
          </p>

          <Link
            to="/login"
            className="mt-8 inline-flex min-h-[44px] items-center justify-center gap-2 font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/50 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Back to sign in
          </Link>
        </section>
      </main>
    </div>
  );
}
