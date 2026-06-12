import React from 'react';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { useSeo } from '@/lib/seo';

export default function Platform() {
  useSeo({
    title: 'Avalon Platform — Coming Soon',
    description: 'Avalon is preparing a client platform for approved care planning and appointment coordination.',
    path: '/platform',
  });
  return (
    <div className="av-page-surface min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 px-5 pt-32 md:px-12 md:pt-40">
        <section className="mx-auto max-w-5xl rounded-3xl border border-foreground/10 bg-foreground/[0.03] p-6 md:p-10">
          <p className="font-body text-[10px] uppercase tracking-[0.28em] text-foreground/40">
            Platform
          </p>
          <h1 className="mt-4 font-heading text-6xl uppercase leading-none text-foreground md:text-8xl">
            COMING SOON!
          </h1>
          <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-foreground/62 md:text-lg">
            Avalon is preparing a client platform for approved care planning, appointment coordination, and visit history.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
