import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardList,
  LogOut,
  MessageCircle,
  Package,
  Sparkles,
  Ticket,
  UserPlus,
} from 'lucide-react';
import MobileNavBar from '@/components/navigation/MobileNavBar';
import QuickPatientAdd from '@/components/ops/QuickPatientAdd';
import { readEventPresales, redeemPresaleCode, buildPresaleSummary } from '@/lib/platformOps';
import { useSeo } from '@/lib/seo';
import { useAuthStore } from '@/lib/useAuthStore';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const MUTED = 'hsl(var(--foreground) / 0.56)';
const DIM = 'hsl(var(--foreground) / 0.34)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.075)';
const BORDER = 'hsl(var(--foreground) / 0.10)';

function ShellHeader({ onSignOut }) {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/[0.08] bg-background/88 px-4 py-3 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link to="/admin" className="flex items-center gap-3">
          <AvalonMark className="h-[22px] w-[14px] text-foreground" />
          <span className="hidden font-body text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/42 sm:inline">Admin</span>
        </Link>
        <div className="text-center">
          <p className="font-heading text-2xl uppercase leading-none tracking-[0.06em] md:text-3xl">Events</p>
          <p className="mt-1 font-body text-[9px] uppercase tracking-[0.22em]" style={{ color: DIM }}>Guest intake</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/[0.10] bg-foreground/[0.045] text-foreground/60"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.7} />
        </button>
      </div>
    </header>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-[20px] px-4 py-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
      <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: DIM }}>{label}</p>
      <p className="mt-2 font-heading text-4xl uppercase leading-none" style={{ color: TEXT }}>{value}</p>
    </div>
  );
}

function EventButton({ event, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[76px] w-full items-center justify-between gap-3 rounded-[22px] px-4 text-left transition-transform active:scale-[0.985]"
      style={{
        background: active ? TEXT : CARD_STRONG,
        color: active ? BG : TEXT,
        border: `1px solid ${active ? TEXT : BORDER}`,
      }}
    >
      <span className="min-w-0">
        <span className="block truncate font-body text-[11px] font-bold uppercase tracking-[0.16em]">{event.name}</span>
        <span className="mt-1 block truncate font-body text-xs" style={{ color: active ? 'hsl(var(--background) / 0.62)' : MUTED }}>
          {event.venue} · {event.date}
        </span>
      </span>
      <span className="shrink-0 rounded-full px-3 py-1 font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{
        color: active ? BG : 'rgb(110,231,183)',
        background: active ? 'hsl(var(--background) / 0.14)' : 'rgba(16,185,129,0.08)',
        border: `1px solid ${active ? 'hsl(var(--background) / 0.18)' : 'rgba(16,185,129,0.20)'}`,
      }}>
        {event.redeemed || 0}
      </span>
    </button>
  );
}

export default function EventsBackend() {
  const { signOut } = useAuthStore();
  const navigate = useNavigate();
  const [presales, setPresales] = useState(() => readEventPresales());
  const [activeEventId, setActiveEventId] = useState(() => readEventPresales().events[0]?.id || '');
  const [notice, setNotice] = useState('');

  const summary = useMemo(() => buildPresaleSummary(presales), [presales]);
  const activeEvent = summary.find((event) => event.id === activeEventId) || summary[0];
  const redemptions = activeEvent
    ? presales.redemptions.filter((item) => item.eventId === activeEvent.id)
    : [];

  useSeo({
    title: 'Event Backend - Avalon Vitality',
    description: 'Avalon local event guest intake and presale roster.',
    robots: 'noindex,nofollow',
  });

  function handleSignOut() {
    signOut();
    navigate('/login', { replace: true });
  }

  function refresh(nextState) {
    const next = nextState || readEventPresales();
    setPresales(next);
    if (!activeEventId && next.events[0]) setActiveEventId(next.events[0].id);
  }

  function addEventGuest(patient) {
    if (!activeEvent) return;
    const safeName = patient.name || 'Guest';
    const code = `${activeEvent.codePrefix || 'AV'}-${Date.now().toString().slice(-5)}`;
    const response = redeemPresaleCode({
      eventId: activeEvent.id,
      code,
      client: {
        name: safeName,
        email: patient.email,
        phone: patient.phone,
      },
      selectedTime: activeEvent.slots?.[0] || activeEvent.window || 'First available',
      intakeStatus: 'GFE intake queued',
      source: 'Event backend quick add',
    });
    refresh(response.state);
    setNotice(response.ok ? `${safeName} added to ${activeEvent.name}.` : response.error);
  }

  return (
    <main className="min-h-dvh pb-24 font-body" style={{ background: BG, color: TEXT }}>
      <ShellHeader onSignOut={handleSignOut} />

      <section className="mx-auto grid max-w-6xl gap-5 px-4 pt-5 md:grid-cols-[0.76fr_1.24fr] md:gap-8 md:px-8 md:pt-8">
        <div className="space-y-5">
          <div className="rounded-[30px] p-5 md:p-6" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="font-body text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: DIM }}>Events</p>
            <h1 className="mt-3 font-heading text-6xl uppercase leading-[0.86] md:text-7xl">Guest<br />Add.</h1>
            <p className="mt-4 max-w-sm font-body text-sm leading-relaxed" style={{ color: MUTED }}>
              Add a presale guest fast. Intake, annual GFE check, roster, and ops alert are queued locally.
            </p>
            {activeEvent && (
              <div className="mt-5">
                <QuickPatientAdd
                  key={activeEvent.id}
                  context="admin"
                  source="Event backend"
                  service={activeEvent.service}
                  event={activeEvent}
                  triggerLabel="Add Guest"
                  triggerClassName="flex min-h-[74px] w-full items-center justify-center gap-2 rounded-[22px] border border-foreground bg-foreground px-4 font-body text-[11px] font-bold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.985]"
                  onCreated={addEventGuest}
                />
              </div>
            )}
            {notice && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)', color: 'rgb(110,231,183)' }}>
                <Check className="h-4 w-4" strokeWidth={2} />
                <p className="font-body text-xs font-semibold uppercase tracking-[0.10em]">{notice}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="Events" value={summary.length || 0} />
            <Stat label="Guests" value={presales.redemptions.length || 0} />
            <Stat label="GFE" value={activeEvent?.gfePending || 0} />
          </div>

          <div className="space-y-2">
            {summary.map((event) => (
              <EventButton
                key={event.id}
                event={event}
                active={activeEvent?.id === event.id}
                onClick={() => {
                  setActiveEventId(event.id);
                  setNotice('');
                }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[30px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: DIM }}>Active launch</p>
                <p className="mt-1 truncate font-heading text-4xl uppercase leading-none">{activeEvent?.name || 'No event'}</p>
              </div>
              <Ticket className="h-5 w-5 shrink-0 text-foreground/42" strokeWidth={1.7} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['Venue', activeEvent?.venue || 'Pending'],
                ['Window', activeEvent?.window || 'Pending'],
                ['Protocol', activeEvent?.service || 'Protocol pending'],
                ['Handoff', activeEvent?.acuityStatus || 'Manual Acuity handoff'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[20px] px-3 py-3" style={{ background: 'hsl(var(--foreground) / 0.035)', border: `1px solid ${BORDER}` }}>
                  <p className="font-body text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: DIM }}>{label}</p>
                  <p className="mt-1 truncate font-body text-sm" style={{ color: TEXT }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] p-5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em]" style={{ color: DIM }}>Redeemed guests</p>
                <p className="mt-1 font-heading text-4xl uppercase leading-none">{redemptions.length || 0}</p>
              </div>
              <UserPlus className="h-5 w-5 text-foreground/42" strokeWidth={1.7} />
            </div>
            <div className="space-y-2">
              {(redemptions.length ? redemptions : [{ id: 'empty', client: { name: 'No guests yet' }, service: 'Add the first guest', intakeStatus: 'Ready', scheduleStatus: 'Local roster' }]).map((item) => (
                <div key={item.id} className="rounded-[22px] px-3.5 py-3" style={{ background: 'hsl(var(--foreground) / 0.035)', border: `1px solid ${BORDER}` }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm font-semibold" style={{ color: TEXT }}>{item.client?.name || 'Guest'}</p>
                      <p className="mt-1 truncate font-body text-[11px]" style={{ color: MUTED }}>
                        {item.selectedTime || item.service} · {item.scheduleStatus || 'Local roster'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 font-body text-[8px] font-bold uppercase tracking-[0.12em]" style={{ color: 'rgb(251,191,36)', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.22)' }}>
                      {item.intakeStatus || 'GFE'}
                    </span>
                  </div>
                  {item.code && (
                    <p className="mt-2 font-body text-[9px] uppercase tracking-[0.18em]" style={{ color: DIM }}>{item.code} · {item.credential}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            {[
              [Sparkles, 'Presale', `${activeEvent?.redeemed || 0} claimed`],
              [CalendarDays, 'GFE', `${activeEvent?.gfePending || 0} pending`],
              [Ticket, 'Capacity', `${activeEvent?.remaining ?? 0} open`],
            ].map(([Icon, label, value]) => (
              <div key={label} className="rounded-[22px] px-3.5 py-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <Icon className="h-4 w-4 text-foreground/42" strokeWidth={1.7} />
                <p className="mt-3 font-body text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: DIM }}>{label}</p>
                <p className="mt-1 font-body text-sm" style={{ color: TEXT }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MobileNavBar
        ariaLabel="Admin navigation"
        columns={5}
        items={[
          { to: '/admin', icon: Check, label: 'Core', exact: true },
          { to: '/admin/bookings', icon: ClipboardList, label: 'Visits' },
          { to: '/admin/events', icon: Ticket, label: 'Events' },
          { to: '/admin/inventory', icon: Package, label: 'Stock' },
          { to: '/', icon: ArrowLeft, label: 'Site', exact: true },
        ]}
      />
    </main>
  );
}
