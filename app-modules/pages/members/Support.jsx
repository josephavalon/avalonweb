import { Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Mail, Phone, HelpCircle, CreditCard, Calendar, UserRound, ExternalLink } from 'lucide-react';
import MemberBottomNav from '@/components/landing/MemberBottomNav';
import { useSeo } from '@/lib/seo';
import MemberSectionNav from './MemberSectionNav.jsx';

const BG = 'hsl(var(--background))';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const ACCENT = 'hsl(var(--accent))';

const SUPPORT_EMAIL = 'support@avalonvitality.co';
const SUPPORT_PHONE_DISPLAY = '(415) 980-7708';
const SUPPORT_PHONE_HREF = 'tel:+14159807708';

const SELF_SERVE = [
  { to: '/members/billing', label: 'Billing', desc: 'Payments, balances & invoices', icon: CreditCard },
  { to: '/members/bookings', label: 'Bookings', desc: 'Your visits & scheduling', icon: Calendar },
  { to: '/members/account', label: 'Account', desc: 'Profile & contact details', icon: UserRound },
];

export default function Support() {
  useSeo({
    title: 'Support - Avalon Vitality',
    description: 'Get help from your Avalon Vitality care team — message us, email, call, or browse the FAQ.',
    path: '/members/support',
  });

  return (
    <div className="min-h-screen pb-[calc(9rem+env(safe-area-inset-bottom))]" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 px-4 py-3 backdrop-blur-2xl" style={{ background: 'hsl(var(--background) / 0.86)', borderBottom: `1px solid ${BORDER}` }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/members/dashboard" className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: CARD, border: `1px solid ${BORDER}` }} aria-label="Back to dashboard">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
          </Link>
          <div className="text-center">
            <p className="font-body text-[9px] uppercase tracking-[0.24em]" style={{ color: DIM }}>Client Portal</p>
            <h1 className="font-heading text-2xl uppercase tracking-[0.08em]">Support</h1>
          </div>
          <span className="h-11 w-11" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 pt-4">
        <MemberSectionNav />

        <section className="rounded-[28px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] uppercase tracking-[0.24em]" style={{ color: DIM }}>We're here for you</p>
          <h2 className="mt-2 font-heading text-5xl uppercase leading-none">Get help</h2>
          <p className="mt-3 font-body text-sm" style={{ color: MUTED }}>
            The fastest way to reach us is to message your care team. We're happy to help with bookings, billing, your plan, or anything else.
          </p>
        </section>

        <Link
          to="/members/messages"
          className="flex items-center justify-between gap-4 rounded-[24px] p-5"
          style={{ background: TEXT, color: INVERT }}
        >
          <span className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 shrink-0" strokeWidth={1.8} />
            <span className="min-w-0">
              <span className="block font-heading text-2xl uppercase leading-none">Message your care team</span>
              <span className="mt-1 block font-body text-xs" style={{ opacity: 0.7 }}>Usually the quickest way to get an answer</span>
            </span>
          </span>
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.16em]">Open</span>
        </Link>

        <section className="grid gap-3 sm:grid-cols-2">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="flex items-center gap-3 rounded-[24px] p-4"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              <Mail className="h-5 w-5" strokeWidth={1.8} style={{ color: ACCENT }} />
            </span>
            <span className="min-w-0">
              <span className="block font-body text-[9px] uppercase tracking-[0.18em]" style={{ color: DIM }}>Email us</span>
              <span className="mt-0.5 block truncate font-body text-sm font-semibold">{SUPPORT_EMAIL}</span>
            </span>
          </a>

          <a
            href={SUPPORT_PHONE_HREF}
            className="flex items-center gap-3 rounded-[24px] p-4"
            style={{ background: CARD, border: `1px solid ${BORDER}` }}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
              <Phone className="h-5 w-5" strokeWidth={1.8} style={{ color: ACCENT }} />
            </span>
            <span className="min-w-0">
              <span className="block font-body text-[9px] uppercase tracking-[0.18em]" style={{ color: DIM }}>Call us</span>
              <span className="mt-0.5 block truncate font-body text-sm font-semibold">{SUPPORT_PHONE_DISPLAY}</span>
            </span>
          </a>
        </section>

        <section className="rounded-[28px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] uppercase tracking-[0.24em]" style={{ color: DIM }}>Self-serve</p>
          <h3 className="mt-2 font-heading text-3xl uppercase leading-none">Common topics</h3>
          <div className="mt-4 grid gap-2">
            {SELF_SERVE.map(({ to, label, desc, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-2xl p-3"
                style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-sm font-semibold">{label}</span>
                  <span className="block font-body text-xs" style={{ color: MUTED }}>{desc}</span>
                </span>
                <ArrowLeft className="h-4 w-4 rotate-180" strokeWidth={1.8} style={{ color: DIM }} />
              </Link>
            ))}
          </div>

          <Link
            to="/faq"
            className="mt-3 flex items-center gap-3 rounded-2xl p-3"
            style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <HelpCircle className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-body text-sm font-semibold">Frequently asked questions</span>
              <span className="block font-body text-xs" style={{ color: MUTED }}>Browse answers to common questions</span>
            </span>
            <ExternalLink className="h-4 w-4" strokeWidth={1.8} style={{ color: DIM }} />
          </Link>
        </section>
      </main>
      <MemberBottomNav />
    </div>
  );
}
