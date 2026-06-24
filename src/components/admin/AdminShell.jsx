import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import {
  Activity,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  CreditCard,
  ExternalLink,
  LayoutGrid,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  UserCog,
  Wrench,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { canAccessAdminRoute } from '@/lib/adminAccess';

// Acuity owns scheduling + nurse dispatch; everything else lives in the console.
const ACUITY_URL = 'https://avalonvitality.as.me';

const NAV_LIVE = [
  { label: 'Dashboard', icon: LayoutGrid, to: '/admin' },
  { label: 'Appointments', icon: CalendarCheck, to: '/admin/bookings' },
  { label: 'Finance', icon: CreditCard, to: '/admin/finance' },
  { label: 'Acuity', icon: CalendarCheck, href: ACUITY_URL, external: true },
  { label: 'Team', icon: UserCog, to: '/admin/team' },
  // Coming-soon placeholders — listed below the working links, all route to the
  // shared /admin/soon page (?feature names what's coming).
  { label: 'Inventory', icon: Package, to: '/admin/soon?feature=Inventory' },
  { label: 'Events', icon: CalendarDays, to: '/admin/soon?feature=Events' },
  { label: 'Clinical Staff', icon: Stethoscope, to: '/admin/soon?feature=Clinical%20Staff' },
  { label: 'GFE', icon: ClipboardList, to: '/admin/soon?feature=GFE' },
  { label: 'Tools', icon: Wrench, to: '/admin/soon?feature=Tools' },
  { label: 'Settings', icon: Settings, to: '/admin/soon?feature=Settings' },
];

const NAV_PREVIEW = [
  {
    label: 'Patients', icon: Users, children: [
      { label: 'All clients', to: '/admin/crm' },
      { label: 'Intake review', to: '/admin/credentials' },
    ],
  },
  { label: 'Analytics', icon: Activity, to: '/admin/client-heat-map' },
  { label: 'Operations', icon: ShieldCheck, to: '/admin/field' },
];

const NAV = [
  ...NAV_LIVE,
  ...(import.meta.env.VITE_ADMIN_PREVIEW === '1' ? NAV_PREVIEW : []),
];

// Filter the nav to what the signed-in role may open. Staff see only the
// customer / scheduling / billing sections; external links (Acuity) stay
// visible to everyone on the team. Source of truth: src/lib/adminAccess.js.
function filterNav(nav, role) {
  return nav
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((c) => canAccessAdminRoute(role, c.to));
        return children.length ? { ...item, children } : null;
      }
      if (item.external) return item;
      if (item.to) return canAccessAdminRoute(role, item.to) ? item : null;
      return item;
    })
    .filter(Boolean);
}

function NavGroup({ item, pathname, onNavigate }) {
  const childActive = item.children?.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`));
  const [open, setOpen] = useState(Boolean(childActive));
  const Icon = item.icon;

  if (item.children) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
            childActive ? 'text-foreground' : 'text-foreground/55 hover:text-foreground'
          }`}
        >
          <span className="flex items-center gap-3">
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            {item.label}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.2} />
        </button>
        <div className={`grid transition-[grid-template-rows] duration-300 ease-editorial ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="ml-[1.55rem] mt-0.5 grid gap-0.5 border-l border-foreground/12 pl-3">
              {item.children.map((c) => {
                const active = pathname === c.to;
                return (
                  <Link
                    key={c.label}
                    to={c.to}
                    onClick={onNavigate}
                    className={`relative rounded-lg px-3 py-2 font-body text-[12px] font-semibold transition-colors ${
                      active ? 'bg-foreground/[0.08] text-foreground' : 'text-foreground/50 hover:text-foreground'
                    }`}
                  >
                    {active && <span className="absolute -left-[calc(0.75rem+1px)] top-1/2 h-4 w-px -translate-y-1/2 bg-foreground" />}
                    {c.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between rounded-xl px-3 py-2.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/55 transition-colors hover:text-foreground"
      >
        <span className="flex items-center gap-3"><Icon className="h-4 w-4" strokeWidth={1.8} />{item.label}</span>
        <ExternalLink className="h-3.5 w-3.5 text-foreground/35" strokeWidth={2} />
      </a>
    );
  }

  const active = pathname === item.to;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
        active ? 'bg-foreground/[0.08] text-foreground' : 'text-foreground/55 hover:text-foreground'
      }`}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-foreground" />}
      <Icon className="h-4 w-4" strokeWidth={1.8} />
      {item.label}
    </Link>
  );
}

export default function AdminShell({ title = 'Dashboard', actions, children, fullBleed = false }) {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);

  const handleSignOut = () => { signOut(); navigate('/login', { replace: true }); };
  const nav = useMemo(() => filterNav(NAV, user?.role), [user?.role]);

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-5">
        <Link to="/" className="flex items-baseline gap-2">
          <AvalonMark className="h-[22px] w-[14px] text-foreground" />
          <span className="font-body text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/40">Admin</span>
        </Link>
        <button type="button" onClick={() => setDrawer(false)} className="text-foreground/50 md:hidden" aria-label="Close menu">
          <X className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5">
        {nav.map((item) => <NavGroup key={item.label} item={item} pathname={pathname} onNavigate={() => setDrawer(false)} />)}
      </nav>
      <div className="border-t border-foreground/[0.08] p-2.5">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-body text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/55 transition-colors hover:text-foreground"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.8} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className={`av-page-surface flex min-h-dvh font-body text-foreground${fullBleed ? ' md:h-dvh md:min-h-0 md:overflow-hidden' : ''}`}>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-foreground/[0.08] bg-foreground/[0.02] md:block">
        {Sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <>
          <button type="button" className="av-modal-scrim fixed inset-0 z-40 md:hidden" onClick={() => setDrawer(false)} aria-label="Close menu" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation menu"
            className="fixed inset-y-0 left-0 z-50 w-64 border-r border-foreground/[0.08] bg-background md:hidden"
          >
            {Sidebar}
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-foreground/[0.08] bg-background/86 px-4 py-3.5 backdrop-blur-2xl md:px-7">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDrawer(true)} className="text-foreground/60 md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" strokeWidth={1.8} />
            </button>
            <h1 className="font-heading text-2xl uppercase leading-none tracking-[0.04em] md:text-3xl">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-foreground/[0.12] bg-foreground/[0.05] text-foreground/80"><AvalonMark className="h-[15px] w-[10px]" /></span>
          </div>
        </header>
        <main className={fullBleed
          ? 'flex min-h-0 flex-1 flex-col md:overflow-hidden'
          : 'mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-7 md:py-7'}
        >{children}</main>
      </div>
    </div>
  );
}
