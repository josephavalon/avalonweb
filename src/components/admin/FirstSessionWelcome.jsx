import { Link } from 'react-router-dom';
import { UserPlus, CalendarCheck, CreditCard, Settings, Users, BookOpen, ArrowRight } from 'lucide-react';

const CARDS_BY_ROLE = {
  admin: [
    { icon: UserPlus,      title: 'Add your first patient',  copy: 'Capture a patient record while you wait for the first booking to land.',           to: '/admin/bookings' },
    { icon: Users,         title: 'Invite your team',         copy: 'Set up staff and admin teammates so collections and scheduling can run in parallel.', to: '/admin/team' },
    { icon: Settings,      title: 'Configure integrations',   copy: 'Confirm Stripe, Acuity, and Resend are wired before the first paid visit.',         to: '/admin/credentials' },
  ],
  staff: [
    { icon: UserPlus,      title: 'Add a patient',            copy: 'Quick-add a patient when ops needs a record before the visit.',                     to: '/admin/bookings' },
    { icon: CalendarCheck, title: 'See today’s bookings',copy: 'Open the live booking queue to see what is ready to collect.',                      to: '/admin/bookings' },
    { icon: CreditCard,    title: 'Open finance view',        copy: 'Run the live finance summary for revenue and balances.',                            to: '/admin/finance' },
  ],
};

const FALLBACK_NAME = 'team';

function pickRoleCopy(role) {
  return CARDS_BY_ROLE[role] || CARDS_BY_ROLE.staff;
}

function firstName(name) {
  if (!name || typeof name !== 'string') return FALLBACK_NAME;
  return name.trim().split(/\s+/)[0] || FALLBACK_NAME;
}

export default function FirstSessionWelcome({ userName, role, variant = 'empty' }) {
  const cards = pickRoleCopy(role);
  const greeting = firstName(userName);
  const isError = variant === 'error';
  const label = isError ? 'Live data unavailable right now' : role === 'admin' ? 'Welcome to Avalon Admin' : 'Welcome to the Avalon console';
  const subhead = isError
    ? 'We could not load the live finance summary. The rest of the console still works — try one of the actions below.'
    : role === 'admin'
      ? 'Once the first booking lands, real revenue and balances will show up here. Until then, here is what to set up.'
      : 'Once today’s bookings come in, the queue will appear here. In the meantime, here are the things you can already do.';

  return (
    <section
      data-testid="admin-first-session-welcome"
      data-variant={variant}
      data-role={role || 'unknown'}
      className="mt-6 overflow-hidden rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.03]"
    >
      <div className="border-b border-foreground/[0.08] px-5 py-4">
        <p className="font-body text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40">{label}</p>
        <h2 className="mt-1 font-heading text-2xl uppercase leading-none">
          Welcome, {greeting}
        </h2>
        <p className="mt-2 max-w-2xl font-body text-sm text-foreground/55">{subhead}</p>
      </div>
      <div className="grid gap-px bg-foreground/[0.06] md:grid-cols-3">
        {cards.map(({ icon: Icon, title, copy, to }) => (
          <Link
            key={title}
            to={to}
            className="group flex flex-col gap-3 bg-background/95 px-5 py-5 transition-colors hover:bg-foreground/[0.04]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-foreground/[0.14] bg-foreground/[0.04]">
              <Icon className="h-4 w-4" strokeWidth={1.9} />
            </div>
            <div>
              <p className="font-heading text-lg uppercase leading-none">{title}</p>
              <p className="mt-2 font-body text-sm text-foreground/55">{copy}</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 font-body text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/45 transition-colors group-hover:text-foreground">
              Open <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
