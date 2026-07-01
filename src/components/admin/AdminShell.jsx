import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AvalonMark from '@/components/AvalonMark';
import {
  Activity,
  Bell,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Crown,
  ExternalLink,
  Inbox,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Palette,
  Settings,
  ShieldCheck,
  Stethoscope,
  User,
  Users,
  UserCog,
  Wrench,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';
import { canAccessAdminRoute } from '@/lib/adminAccess';
import { apiGet } from '@/lib/apiClient';
import { cycleTheme, getThemeLabel, readStoredTheme } from '@/lib/theme';

// Acuity owns scheduling + nurse dispatch; everything else lives in the console.
const ACUITY_URL = 'https://avalonvitality.as.me';

// Roadmap leaves that aren't built yet route to the shared coming-soon stub.
const soon = (feature) => `/admin/soon?feature=${encodeURIComponent(feature)}`;

// 8 top-level items with detail nested beneath. Keeps the sidebar shallow at
// the top level (Stripe/Shopify/Linear pattern) — every existing route is still
// reachable, just grouped by the work they support.
const NAV_LIVE = [
  { label: 'Dashboard', icon: LayoutGrid, to: '/admin' },
  { label: 'Bookings', icon: CalendarCheck, to: '/admin/bookings' },
  {
    label: 'Patients', icon: Users, children: [
      { label: 'Patient records', to: '/admin/clients' },
      { label: 'Memberships', to: '/admin/memberships' },
      { label: 'Expiring credits', to: '/admin/expiring-credits' },
      { label: 'Deletion requests', to: '/admin/deletion-requests' },
    ],
  },
  {
    label: 'Communications', icon: MessageSquare, children: [
      { label: 'Client inbox', to: '/admin/messages' },
      { label: 'Email templates', to: '/admin/email-templates' },
      { label: 'Reviews', to: '/admin/reviews' },
      { label: 'Support tickets', to: '/admin/support-tickets' },
      { label: 'Broadcasts', to: '/admin/soon?feature=Broadcasts' },
      { label: 'SMS templates', to: '/admin/soon?feature=SMS%20Templates' },
    ],
  },
  {
    label: 'Finance', icon: CreditCard, children: [
      {
        label: 'Executive', children: [
          { label: 'Dashboard', to: '/admin/finance' },
          { label: 'Reconciliation', to: '/admin/reconciliation' },
          { label: 'KPI Scorecard', to: soon('KPI Scorecard') },
          { label: 'Cash Position', to: soon('Cash Position') },
          { label: 'Runway', to: soon('Runway') },
          { label: 'Financial Calendar', to: soon('Financial Calendar') },
        ],
      },
      {
        label: 'Revenue & Payments', children: [
          { label: 'Revenue Dashboard', to: soon('Revenue Dashboard') },
          { label: 'Sales', to: soon('Sales') },
          { label: 'Memberships', to: soon('Memberships') },
          { label: 'Packages', to: soon('Packages') },
          { label: 'Gift Cards', to: soon('Gift Cards') },
          { label: 'Promo codes', to: '/admin/promo-codes' },
          { label: 'Transactions', to: soon('Transactions') },
          { label: 'Deposits', to: soon('Deposits') },
          { label: 'Outstanding Balances', to: soon('Outstanding Balances') },
          { label: 'Invoices', to: soon('Invoices') },
          { label: 'Refunds', to: '/admin/refunds' },
          { label: 'Chargebacks', to: soon('Chargebacks') },
        ],
      },
      {
        label: 'Banking & Accounting', children: [
          { label: 'Cash Flow', to: soon('Cash Flow') },
          { label: 'Bank Accounts', to: soon('Bank Accounts') },
          { label: 'Transfers', to: soon('Transfers') },
          { label: 'Bank Reconciliation', to: soon('Bank Reconciliation') },
          { label: 'Profit & Loss', to: soon('Profit & Loss') },
          { label: 'Balance Sheet', to: soon('Balance Sheet') },
          { label: 'Cash Flow Statement', to: soon('Cash Flow Statement') },
          { label: 'General Ledger', to: soon('General Ledger') },
          { label: 'Journal Entries', to: soon('Journal Entries') },
          { label: 'Chart of Accounts', to: soon('Chart of Accounts') },
          { label: 'Closing Periods', to: soon('Closing Periods') },
          { label: 'Mercury', to: soon('Mercury') },
          { label: 'QuickBooks', to: soon('QuickBooks') },
        ],
      },
      {
        label: 'Expenses & Payroll', children: [
          { label: 'Operating Expenses', to: soon('Operating Expenses') },
          { label: 'Vendor Bills', to: soon('Vendor Bills') },
          { label: 'Employee Reimbursements', to: soon('Employee Reimbursements') },
          { label: 'Mileage', to: soon('Mileage') },
          { label: 'Corporate Cards', to: soon('Corporate Cards') },
          { label: 'Employees', to: soon('Employees') },
          { label: 'Contractors', to: soon('Contractors') },
          { label: 'Payroll Runs', to: soon('Payroll Runs') },
          { label: 'Benefits', to: soon('Benefits') },
          { label: 'Payroll Taxes', to: soon('Payroll Taxes') },
          { label: 'Tax Documents', to: soon('Tax Documents') },
          { label: 'Gusto', to: soon('Gusto') },
        ],
      },
      {
        label: 'Inventory Finance', children: [
          { label: 'Inventory Value', to: soon('Inventory Value') },
          { label: 'COGS', to: soon('COGS') },
          { label: 'Purchase Orders', to: soon('Purchase Orders') },
          { label: 'Vendor Spend', to: soon('Vendor Spend') },
          { label: 'Inventory Turnover', to: soon('Inventory Turnover') },
          { label: 'Expired Inventory', to: soon('Expired Inventory') },
          { label: 'Shrinkage', to: soon('Shrinkage') },
          { label: 'Cost Analysis', to: soon('Cost Analysis') },
        ],
      },
      {
        label: 'Planning & Metrics', children: [
          { label: 'Financial Metrics', to: soon('Financial Metrics') },
          { label: 'Growth Metrics', to: soon('Growth Metrics') },
          { label: 'Unit Economics', to: soon('Unit Economics') },
          { label: 'Revenue per Nurse', to: soon('Revenue per Nurse') },
          { label: 'Revenue per Visit', to: soon('Revenue per Visit') },
          { label: 'Gross Margin by Service', to: soon('Gross Margin by Service') },
          { label: 'Gross Margin by Market', to: soon('Gross Margin by Market') },
          { label: 'Revenue Forecast', to: soon('Revenue Forecast') },
          { label: 'Cash Forecast', to: soon('Cash Forecast') },
          { label: 'Budget', to: soon('Budget') },
          { label: 'Budget vs Actual', to: soon('Budget vs Actual') },
          { label: 'Hiring Forecast', to: soon('Hiring Forecast') },
          { label: 'Scenario Planning', to: soon('Scenario Planning') },
        ],
      },
      {
        label: 'Reports & Fundraising', children: [
          { label: 'Executive Reports', to: soon('Executive Reports') },
          { label: 'Financial Statements', to: soon('Financial Statements') },
          { label: 'Revenue Reports', to: soon('Revenue Reports') },
          { label: 'Expense Reports', to: soon('Expense Reports') },
          { label: 'Payroll Reports', to: soon('Payroll Reports') },
          { label: 'Inventory Reports', to: soon('Inventory Reports') },
          { label: 'Tax Reports', to: soon('Tax Reports') },
          { label: 'Custom Reports', to: soon('Custom Reports') },
          { label: 'Financial Model', to: soon('Financial Model') },
          { label: 'Cap Table', to: soon('Cap Table') },
          { label: 'SAFE Notes', to: soon('SAFE Notes') },
          { label: 'Investors', to: soon('Investors') },
          { label: 'Data Room', to: soon('Data Room') },
          { label: 'Board Reports', to: soon('Board Reports') },
        ],
      },
    ],
  },
  {
    label: 'Operations', icon: ShieldCheck, children: [
      { label: 'Team', to: '/admin/team' },
      {
        label: 'Clinical', children: [
          {
            label: 'Staff', children: [
              { label: 'Clinical Staff', to: '/admin/soon?feature=Clinical%20Staff' },
              { label: 'Nurse Records', to: '/admin/soon?feature=Nurse%20Records' },
              { label: 'Credentialing', to: '/admin/soon?feature=Credentialing' },
              { label: 'Contracts', to: '/admin/soon?feature=Contracts' },
              { label: 'Insurance', to: '/admin/soon?feature=Insurance' },
            ],
          },
          {
            label: 'Documentation', children: [
              { label: 'Nursing Manual', to: '/admin/soon?feature=Nursing%20Manual' },
              { label: 'SOPs', to: '/admin/soon?feature=SOPs' },
              { label: 'Standing Orders', to: '/admin/soon?feature=Standing%20Orders' },
              { label: 'Policies', to: '/admin/soon?feature=Policies' },
              { label: 'Forms & Templates', to: '/admin/soon?feature=Forms%20%26%20Templates' },
            ],
          },
          {
            label: 'Quality', children: [
              { label: 'Quality Assurance', to: '/admin/soon?feature=Quality%20Assurance' },
              { label: 'Incident Reports', to: '/admin/soon?feature=Incident%20Reports' },
              { label: 'Audits', to: '/admin/soon?feature=Audits' },
              { label: 'Training', to: '/admin/soon?feature=Training' },
            ],
          },
          { label: 'Clinical Inventory', to: '/admin/soon?feature=Clinical%20Inventory' },
        ],
      },
      { label: 'GFE', to: '/admin/gfe' },
      { label: 'Acuity', href: ACUITY_URL, external: true },
      { label: 'Shift marketplace', to: '/admin/shift-marketplace' },
      { label: 'Inventory', to: '/admin/soon?feature=Inventory' },
      { label: 'Tools', to: '/admin/soon?feature=Tools' },
    ],
  },
  {
    label: 'Events', icon: CalendarDays, children: [
      { label: 'Upcoming', to: soon('Upcoming Events') },
      { label: 'Service', to: soon('Event Service') },
      { label: 'GFE queue', to: soon('Event GFE Queue') },
      { label: 'Orders', to: soon('Event Orders') },
      { label: 'Proposals', to: soon('Event Proposals') },
      { label: 'Past', to: soon('Past Events') },
    ],
  },
  { label: 'Settings', icon: Settings, to: '/admin/soon?feature=Settings' },
];

const NAV_PREVIEW = [
  {
    label: 'CRM', icon: Users, children: [
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
        // Recursively filter so nested groups (e.g. Finance → Revenue → items)
        // strip leaves the role can't reach AND drop empty subgroups.
        const children = filterNav(item.children, role);
        return children.length ? { ...item, children } : null;
      }
      if (item.external) return item;
      if (item.to) return canAccessAdminRoute(role, item.to) ? item : null;
      return item;
    })
    .filter(Boolean);
}

// Deep-active = any descendant route (Finance → Revenue → Revenue Dashboard) matches.
function isItemActive(item, pathname) {
  if (item.children) return item.children.some((c) => isItemActive(c, pathname));
  if (!item.to) return false;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NestedGroup({ item, pathname, onNavigate, depth = 1 }) {
  const childActive = item.children?.some((c) => isItemActive(c, pathname));
  const [open, setOpen] = useState(Boolean(childActive));
  // Uppercase at every level; hierarchy reads through opacity + indentation,
  // not casing or size. Deeper group headers sit one step quieter.
  const idleColor = depth >= 2 ? 'text-foreground/45' : 'text-foreground/65';
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 font-body text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
          childActive ? 'text-foreground' : `${idleColor} hover:text-foreground`
        }`}
      >
        {item.label}
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.2} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-editorial ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="ml-3 mt-0.5 grid gap-0.5 border-l border-foreground/10 pl-3">
            {item.children.map((c) => (
              c.children
                ? <NestedGroup key={c.label} item={c} pathname={pathname} onNavigate={onNavigate} depth={depth + 1} />
                : <ChildLeaf key={c.label} item={c} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChildLeaf({ item, pathname, onNavigate }) {
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className="relative flex items-center justify-between rounded-lg px-3 py-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/45 transition-colors hover:text-foreground"
      >
        {item.label}
        <ExternalLink className="h-3 w-3 shrink-0 text-foreground/30" strokeWidth={2} />
      </a>
    );
  }
  const active = pathname === item.to;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={`relative rounded-lg px-3 py-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
        active ? 'bg-foreground/[0.08] text-foreground' : 'text-foreground/45 hover:text-foreground'
      }`}
    >
      {active && <span className="absolute -left-[calc(0.75rem+1px)] top-1/2 h-3.5 w-px -translate-y-1/2 bg-foreground" />}
      {item.label}
    </Link>
  );
}

function NavGroup({ item, pathname, onNavigate }) {
  const childActive = item.children?.some((c) => isItemActive(c, pathname));
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
            <div className="ml-3 mt-0.5 grid gap-0.5 border-l border-foreground/10 pl-3">
              {item.children.map((c) => (
                c.children
                  ? <NestedGroup key={c.label} item={c} pathname={pathname} onNavigate={onNavigate} depth={1} />
                  : <ChildLeaf key={c.label} item={c} pathname={pathname} onNavigate={onNavigate} />
              ))}
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

// Top-right profile menu: name + role + Messages link + per-channel
// notification toggles. Persists toggles to localStorage for now — the
// server-side dispatch hook reads from the same key when alerting on a new
// admin message.
const ADMIN_NOTIF_KEY = 'av:admin:notif-prefs:v1';
const DEFAULT_NOTIF_PREFS = { email: true, sms: false };

function readNotifPrefs() {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_NOTIF_PREFS };
    const raw = localStorage.getItem(ADMIN_NOTIF_KEY);
    if (!raw) return { ...DEFAULT_NOTIF_PREFS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_NOTIF_PREFS, ...parsed };
  } catch { return { ...DEFAULT_NOTIF_PREFS }; }
}

function writeNotifPrefs(prefs) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ADMIN_NOTIF_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

function roleLabel(role) {
  if (!role) return 'Team';
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ToggleRow({ on, onToggle, label, hint, disabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className="flex w-full items-start justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-foreground/[0.04] disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block font-body text-xs font-semibold text-foreground">{label}</span>
        {hint ? <span className="mt-0.5 block font-body text-[10px] text-foreground/45">{hint}</span> : null}
      </span>
      <span
        className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${on ? 'border-foreground bg-foreground' : 'border-foreground/30 bg-foreground/[0.06]'}`}
        aria-pressed={on}
      >
        <span
          className={`block h-3.5 w-3.5 rounded-full transition-transform ${on ? 'translate-x-[18px] bg-background' : 'translate-x-[3px] bg-foreground/60'}`}
        />
      </span>
    </button>
  );
}

// Row inside the profile menu: a left icon+label and an optional right slot
// (unread badge, theme name, chevron). Renders as a Link or a button.
function MenuRow({ icon: Icon, label, to, onClick, right, danger }) {
  const cls = `flex w-full items-center justify-between px-4 py-2.5 text-left font-body text-xs font-semibold transition-colors hover:bg-foreground/[0.04] ${danger ? 'text-foreground/60 hover:text-foreground' : 'text-foreground'}`;
  const inner = (
    <>
      <span className="flex items-center gap-2.5">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
        {label}
      </span>
      {right != null ? <span className="flex items-center gap-1.5">{right}</span> : null}
    </>
  );
  if (to) return <Link to={to} onClick={onClick} className={cls}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

function AdminProfileMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [prefs, setPrefs] = useState(() => readNotifPrefs());
  const [themeLabel, setThemeLabel] = useState(() => getThemeLabel(readStoredTheme()));
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Team-inbox unread badge — lightweight poll on the new service-role API
  // (replaces the old realtime useMessages() hook). Fails closed to 0.
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const fetchUnread = async () => {
      try {
        const data = await apiGet('/api/admin/team-messages/unread');
        if (alive) setUnreadCount(Number(data?.unread) || 0);
      } catch {
        if (alive) setUnreadCount(0);
      }
    };
    fetchUnread();
    const t = setInterval(fetchUnread, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // Anchor the menu to the trigger with FIXED positioning, rendered through a
  // portal on document.body. The admin header uses backdrop-filter, which
  // establishes a containing block + stacking context that was swallowing the
  // absolutely-positioned menu (it never appeared). A body portal escapes it.
  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    setCoords({ top: Math.round(r.bottom + 8), right: Math.round(Math.max(8, window.innerWidth - r.right)) });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    place();
    const onDoc = (e) => {
      if (triggerRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onReflow = () => place();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, place]);

  const toggle = (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    writeNotifPrefs(next);
  };

  // Cycle the theme in place; keep the menu open so the change is visible.
  const onCycleTheme = () => { setThemeLabel(getThemeLabel(cycleTheme())); };

  const name = user?.name || user?.fullName || user?.email?.split('@')[0] || 'Admin';
  const role = roleLabel(user?.role);
  const isAdmin = user?.role === 'admin';
  const close = () => setOpen(false);

  const menu = open && coords && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ position: 'fixed', top: coords.top, right: coords.right, zIndex: 9999 }}
          className="w-72 overflow-hidden rounded-xl border border-foreground/[0.10] bg-background shadow-[0_18px_60px_rgba(0,0,0,0.6)]"
        >
          <div className="border-b border-foreground/[0.08] px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="font-heading text-lg uppercase leading-none">{name}</p>
              <span className="rounded-md border border-foreground/[0.18] px-1.5 py-0.5 font-body text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/55">{role}</span>
            </div>
            {user?.email ? <p className="mt-1.5 truncate font-body text-xs text-foreground/55">{user.email}</p> : null}
          </div>

          <div className="border-b border-foreground/[0.06] py-1">
            <MenuRow
              icon={Inbox}
              label="My inbox"
              to="/admin/team-inbox"
              onClick={close}
              right={unreadCount > 0
                ? <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 font-body text-[9px] font-bold text-background">{unreadCount > 99 ? '99+' : unreadCount}</span>
                : <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-foreground/35" strokeWidth={2} />}
            />
            <MenuRow icon={User} label="Profile" to="/admin/soon?feature=Profile" onClick={close} />
            <MenuRow
              icon={Palette}
              label="Appearance"
              onClick={onCycleTheme}
              right={<span className="font-body text-[11px] text-foreground/45">{themeLabel}</span>}
            />
            {isAdmin ? <MenuRow icon={Users} label="Team & access" to="/admin/team" onClick={close} /> : null}
            <MenuRow icon={Activity} label="Activity" to="/admin/soon?feature=Activity" onClick={close} />
          </div>

          <div className="border-b border-foreground/[0.06] px-2 py-2">
            <p className="px-2 pb-1.5 font-body text-[9px] font-bold uppercase tracking-[0.18em] text-foreground/40">
              <Bell className="-mt-0.5 mr-1 inline h-3 w-3" strokeWidth={2.2} />
              New-message alerts
            </p>
            <ToggleRow
              on={prefs.email}
              onToggle={() => toggle('email')}
              label="Email"
              hint={user?.email || 'No email on file'}
              disabled={!user?.email}
            />
            <ToggleRow
              on={prefs.sms}
              onToggle={() => toggle('sms')}
              label="SMS"
              hint={user?.phone || 'No phone on file'}
              disabled={!user?.phone}
            />
            <p className="px-2 pt-1 font-body text-[10px] text-foreground/40">
              Turn either off to stop getting pinged about new messages.
            </p>
          </div>

          <MenuRow icon={LogOut} label="Sign out" onClick={() => { close(); onSignOut(); }} danger />
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-foreground transition-opacity hover:opacity-80"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        <AvalonMark className="h-7 w-[18px] text-foreground" />
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>
      {menu}
    </div>
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
        <Link to="/admin" className="flex items-center gap-2.5">
          <AvalonMark className="h-9 w-[22px] text-foreground" />
          <span className="font-heading text-2xl uppercase leading-none tracking-[0.08em] text-foreground">Admin</span>
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
            <AdminProfileMenu user={user} onSignOut={handleSignOut} />
          </div>
        </header>
        <main className={fullBleed
          ? 'flex min-h-0 flex-1 flex-col md:overflow-hidden'
          : 'mx-auto w-full max-w-6xl flex-1 px-4 py-4 md:px-7 md:py-5'}
        >{children}</main>
      </div>
    </div>
  );
}
