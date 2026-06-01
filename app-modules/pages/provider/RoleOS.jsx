import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  ClipboardCheck,
  LogOut,
  MessageCircle,
  Package,
  Settings,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import { useSeo } from '@/lib/seo';
import { useAuthStore } from '@/lib/useAuthStore';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.56)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';

function normalize(value) {
  return String(value || '').toLowerCase();
}

function ToolCard({ to, icon: Icon, label, detail, primary }) {
  return (
    <Link
      to={to}
      className="group flex min-h-[76px] items-center justify-between rounded-[22px] px-4 transition-all active:scale-[0.985]"
      style={{
        background: primary ? TEXT : CARD_STRONG,
        color: primary ? BG : TEXT,
        border: `1px solid ${primary ? TEXT : BORDER}`,
      }}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
          style={{
            background: primary ? 'hsl(var(--background) / 0.12)' : CARD,
            border: `1px solid ${primary ? 'hsl(var(--background) / 0.16)' : BORDER}`,
          }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="block font-body text-[11px] font-bold uppercase tracking-[0.16em]">{label}</span>
          <span className="mt-1 block truncate font-body text-xs" style={{ color: primary ? 'hsl(var(--background) / 0.62)' : MUTED }}>
            {detail}
          </span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" strokeWidth={1.8} />
    </Link>
  );
}

function CheckRow({ label, detail }) {
  return (
    <div className="flex min-h-[58px] items-center gap-3 rounded-[18px] px-3.5 py-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
        <Check className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block font-body text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: TEXT }}>{label}</span>
        <span className="mt-1 block truncate font-body text-xs" style={{ color: MUTED }}>{detail}</span>
      </span>
    </div>
  );
}

function Section({ id, eyebrow, title, children }) {
  return (
    <section id={id} className="rounded-[30px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: DIM }}>{eyebrow}</p>
      <h2 className="mt-2 font-heading text-4xl uppercase leading-none" style={{ color: TEXT }}>{title}</h2>
      <div className="mt-4 grid gap-2">{children}</div>
    </section>
  );
}

export default function RoleOS() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const role = normalize(user?.role || 'provider');
  const canClear = ['admin', 'np', 'physician'].includes(role);
  const isAdmin = role === 'admin';

  useSeo({
    title: `${isAdmin ? 'Admin Tools' : 'Provider Tools'} - Avalon Vitality`,
    description: 'Avalon role tools for fast field execution.',
    path: isAdmin ? '/admin/role-os' : '/provider/role-os',
    robots: 'noindex, nofollow',
  });

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  return (
    <main className="min-h-dvh pb-24 font-body" style={{ background: BG, color: TEXT }}>
      <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/88 px-4 py-3 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="font-heading text-2xl tracking-[0.18em]">AV</span>
            <span className="hidden font-body text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/42 sm:inline">Tools</span>
          </Link>
          <div className="text-center">
            <p className="font-heading text-2xl uppercase leading-none tracking-[0.06em]">Field</p>
            <p className="mt-1 font-body text-[9px] uppercase tracking-[0.22em]" style={{ color: DIM }}>{isAdmin ? 'Admin' : 'Nurse'}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/[0.10] bg-foreground/[0.045] text-foreground/60"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.7} />
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 pt-5 md:px-8 md:pt-8">
        <div className="rounded-[32px] p-5 md:p-7" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
          <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Work</p>
          <h1 className="mt-3 font-heading text-7xl uppercase leading-[0.84] md:text-8xl">Tools.</h1>
          <p className="mt-4 max-w-sm font-body text-sm leading-relaxed" style={{ color: MUTED }}>
            The field surface is simple: shift, route, kit, protocol, messages.
          </p>
          <div className="mt-5 grid gap-2">
            <ToolCard to="/provider/shift" icon={Stethoscope} label="Shift" detail="Visit, ETA, closeout" primary />
            <ToolCard to="/provider/communications" icon={MessageCircle} label="Messages" detail="Ops and client comms" />
            <ToolCard to="#kit" icon={Package} label="Kit" detail="What to bring" />
            <ToolCard to="#protocol" icon={BookOpenCheck} label="Protocol" detail="Review before treatment" />
            {canClear ? <ToolCard to="/provider/invoicing" icon={ShieldCheck} label="Clearance" detail="Clinical review lane" /> : null}
            {isAdmin ? <ToolCard to="/admin" icon={ClipboardCheck} label="Admin" detail="Return to control" /> : null}
          </div>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Section id="kit" eyebrow="Kit" title="Bring">
            <CheckRow label="Fluids" detail="Protocol base and backup bag." />
            <CheckRow label="Meds" detail="Only what protocol allows." />
            <CheckRow label="Supplies" detail="IV start, PPE, sharps, waste." />
          </Section>

          <Section id="protocol" eyebrow="Protocol" title="Review">
            <CheckRow label="Order" detail="Confirm the selected protocol." />
            <CheckRow label="Screen" detail="Contraindications and vitals." />
            <CheckRow label="Chart" detail="Complete in the external record." />
          </Section>
        </div>
      </section>

      <MobileNavBar
        ariaLabel="Provider navigation"
        columns={5}
        items={[
          { to: '/provider/dashboard', icon: CalendarClock, label: 'Home' },
          { to: '/provider/shift', icon: Stethoscope, label: 'Shift', primary: true },
          { to: '/provider/communications', icon: MessageCircle, label: 'Text' },
          { to: '/provider/role-os', icon: Package, label: 'Kit', exact: true },
          { to: '/provider/settings', icon: Settings, label: 'Me' },
        ]}
      />
    </main>
  );
}
