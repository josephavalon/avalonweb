import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  LayoutDashboard, Users, Calendar, CalendarClock, FileText,
  BarChart3, Package, Shield, Mail, LogOut,
  X, ChevronRight, Syringe, FileBarChart2,
  MoreHorizontal, ArrowLeft,
  ClipboardList, UserCheck, CreditCard, Star,
  Archive, MessageSquare, TrendingUp, Settings,
  Zap, Grid3X3, Send, MapPin, GraduationCap,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';

// ─── Theme sync ──────────────────────────────────────────────────────────────
const THEMES = ['dark', 'light'];
const THEME_KEY = 'avalon.theme';

const readInitialTheme = () => {
  try {
    const s = window.localStorage.getItem(THEME_KEY);
    if (s && THEMES.includes(s)) return s;
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[admin-theme-read]', err);
  }
  return 'dark';
};

// ─── Nav items ─────────────────────────────────────────────────────────────
const NAV = [
  // Primary — always visible
  { to: '/provider/dashboard',      icon: Zap,             label: 'Command',    roles: ['admin', 'superadmin'], primary: true },
  { to: '/provider/appointments',   icon: ClipboardList,   label: 'Requests',   roles: ['admin', 'superadmin'], primary: true, badge: 8 },
  { to: '/admin/acuity',            icon: CalendarClock,   label: 'Acuity',     roles: ['admin', 'superadmin'], primary: true },
  { to: '/provider/clients',        icon: Users,           label: 'Clients',    roles: ['admin', 'superadmin'], primary: true },
  { to: '/admin/dispatch',          icon: Send,            label: 'Dispatch',   roles: ['admin', 'superadmin'] },
  { to: '/admin/field',             icon: MapPin,          label: 'Field',      roles: ['admin', 'superadmin'] },
  { to: '/admin/kits',              icon: Package,         label: 'Kits',       roles: ['admin', 'superadmin'] },
  { to: '/admin/training',          icon: GraduationCap,   label: 'Training',   roles: ['admin', 'superadmin'] },
  { to: '/admin/crm',               icon: Mail,            label: 'CRM',        roles: ['admin', 'superadmin'] },
  { to: '/admin/finance',           icon: CreditCard,      label: 'Finance',    roles: ['admin', 'superadmin'] },
  { to: '/provider/staff',          icon: UserCheck,       label: 'Nurses',     roles: ['admin', 'superadmin'], primary: true },
  { to: '/admin/credentials',       icon: Shield,          label: 'Credentials',roles: ['admin', 'superadmin'] },
  // Nurse shift view
  { to: '/provider/shift',          icon: Syringe,         label: 'My Shift',   roles: ['provider'], primary: true },
  { to: '/provider/communications', icon: MessageSquare,   label: 'Messages',   roles: ['provider'], primary: true },
  { to: '/provider/acuity',         icon: CalendarClock,   label: 'Acuity',     roles: ['provider'], primary: true },
  { to: '/provider/role-os',        icon: Grid3X3,         label: 'Tools',      roles: ['provider'], primary: true },
  { to: '/provider/crm',            icon: Mail,            label: 'CRM',        roles: ['provider'] },
  { to: '/provider/finance',        icon: CreditCard,      label: 'Finance',    roles: ['provider'] },
  { to: '/provider/credentials',    icon: Shield,          label: 'Credentials',roles: ['provider'] },
  { to: '/provider/dispatch',       icon: Send,            label: 'Dispatch',   roles: ['provider'] },
  { to: '/provider/field',          icon: MapPin,          label: 'Field',      roles: ['provider'] },
  { to: '/provider/kits',           icon: Package,         label: 'Kits',       roles: ['provider'] },
  { to: '/provider/training',       icon: GraduationCap,   label: 'Training',   roles: ['provider'] },
  // Extended — overflow on mobile
  { to: '/provider/invoicing',      icon: CreditCard,      label: 'Clearance',  roles: ['admin', 'superadmin'] },
  { to: '/provider/accounting',     icon: FileText,        label: 'Payments',   roles: ['admin', 'superadmin'] },
  { to: '/provider/services',       icon: Star,            label: 'Memberships',roles: ['admin', 'superadmin'] },
  { to: '/provider/communications', icon: MessageSquare,   label: 'Messages',   roles: ['admin', 'superadmin'] },
  { to: '/admin/role-os',           icon: Grid3X3,         label: 'Role OS',    roles: ['admin', 'superadmin'] },
  { to: '/provider/reports',        icon: TrendingUp,      label: 'Reports',    roles: ['admin', 'superadmin'] },
  { to: '/admin/inventory',         icon: Package,         label: 'Inventory',  roles: ['admin', 'superadmin'] },
  { to: '/provider/settings',       icon: Settings,        label: 'Settings',   roles: ['admin', 'superadmin'] },
];

// Bottom tab bar — primary tabs only
const BOTTOM_TAB_COUNT = 4;

const ROLE_BADGE = {
  superadmin: 'Superadmin',
  admin:      'Admin',
  provider:   'Nurse',
  np:         'NP',
  physician:  'MD',
  client:     'Client',
};

const EASE = [0.16, 1, 0.3, 1];

// ─── Component ─────────────────────────────────────────────────────────────
export default function AdminLayout({ children, fullBleed = false }) {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme] = useState(readInitialTheme);

  // Auth guard
  React.useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  // Close More sheet on nav
  React.useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  // Sync theme to <html> + localStorage
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'golden', 'dubs');
    if (theme !== 'light') document.documentElement.classList.add(theme);
    try { window.localStorage.setItem(THEME_KEY, theme); } catch (err) {
      if (import.meta.env?.DEV) console.warn('[admin-theme-write]', err);
    }
  }, [theme]);

  const role = user?.role || 'provider';
  const navRole = ['np', 'physician'].includes(role) ? 'provider' : role;
  const visibleNav = NAV.filter(n => n.roles.includes(navRole));
  const bottomTabs = visibleNav.slice(0, BOTTOM_TAB_COUNT);
  const overflowNav = visibleNav.slice(BOTTOM_TAB_COUNT);
  const isActive = (to) => location.pathname === to;

  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };

  // ── Sidebar content (desktop only) ────────────────────────────────────
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo + identity */}
      <div className="px-6 pt-6 pb-5 border-b border-foreground/[0.08]">
        <Link to="/" className="mb-4 inline-flex min-h-11 flex-col justify-center leading-none transition-colors hover:text-foreground/70">
          <span className="block font-heading text-[17px] tracking-[0.22em] text-foreground leading-none">AVALON</span>
          <span className="block font-body text-[7px] tracking-[0.38em] text-foreground/58 uppercase mt-0.5">VITALITY</span>
        </Link>
        <div>
          <p className="text-[11px] tracking-[0.2em] uppercase font-medium text-foreground/80">
            {user?.name || 'Provider'}
          </p>
          <span className="inline-block mt-1 text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full border border-accent/40 text-accent">
            {ROLE_BADGE[role] || 'Staff'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="px-3 mb-3 text-[9px] tracking-[0.3em] uppercase text-foreground/40 font-medium">
          Avalon Command
        </p>
        <LayoutGroup id="admin-sidebar-nav">
          {visibleNav.map(({ to, icon: Icon, label }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className="relative isolate mb-0.5 flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm transition-colors"
                style={{ color: active ? 'hsl(var(--accent))' : 'hsl(var(--foreground))' }}
              >
                {active && (
                  <motion.span
                    layoutId="admin-sidebar-active"
                    className="absolute inset-0 -z-10 rounded-xl bg-foreground/[0.095] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10)]"
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                )}
                <Icon
                  className="w-4 h-4 shrink-0"
                  strokeWidth={1.5}
                  style={{ color: active ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.6)' }}
                />
                <span className="font-body text-[13px] tracking-wide">{label}</span>
              </Link>
            );
          })}
        </LayoutGroup>
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 border-t border-foreground/[0.06] pt-4 space-y-0.5">
        <Link
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground/60 hover:text-foreground transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" strokeWidth={1.5} />
          <span className="font-body text-[12px]">Back to site</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-foreground/60 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          <span className="font-body text-[12px]">Sign Out</span>
        </button>
      </div>
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────
  return (
    <div className={`${theme !== 'light' ? theme : ''} min-h-screen flex bg-background text-foreground`}>

      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 fixed left-0 top-0 h-full z-30 border-r border-foreground/[0.08] bg-background/72 shadow-[18px_0_80px_hsl(var(--foreground)/0.06)] backdrop-blur-2xl">
        <SidebarContent />
      </aside>

      {/* ── Main content area ──────────────────────────────────────── */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">

        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-20 mx-3 mt-3 flex items-center justify-between rounded-[1.5rem] border border-foreground/[0.10] bg-background/82 px-4 py-3 shadow-[0_18px_70px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl">
          {/* Role badge */}
          <div className="flex items-center gap-2">
            <Link to="/" className="inline-flex min-h-11 flex-col justify-center leading-none text-foreground transition-colors hover:text-foreground/70">
              <span className="block font-heading text-[16px] leading-none tracking-[0.22em]">AVALON</span>
              <span className="block font-body text-[7px] uppercase tracking-[0.34em] text-foreground/58">OS</span>
            </Link>
            <span className="text-[9px] tracking-[0.2em] uppercase px-1.5 py-0.5 rounded-full border border-accent/40 text-accent font-body">
              {ROLE_BADGE[role] || 'Staff'}
            </span>
          </div>
          {/* User + sign out */}
          <div className="flex items-center gap-3">
            <p className="font-body text-[11px] text-foreground/50 tracking-wide hidden xs:block">
              {user?.name?.split(' ')[0] || ''}
            </p>
            <button
              onClick={handleSignOut}
              className="w-8 h-8 flex items-center justify-center rounded-full text-foreground/50 hover:text-red-400 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Page content — extra bottom padding on mobile so bottom tabs don't overlap */}
        <main className={fullBleed ? 'flex-1 flex flex-col md:overflow-hidden' : 'flex-1 p-5 pt-5 md:p-8 max-w-[1280px] w-full pb-24 md:pb-8'}>
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ──────────────────────────────────── */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-foreground/[0.08] bg-background/88 shadow-[0_-18px_70px_hsl(var(--foreground)/0.08)] backdrop-blur-2xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      >
        <div className="flex items-stretch">
          {/* Primary tabs */}
          <LayoutGroup id="provider-bottom-tabs">
          {bottomTabs.map(({ to, icon: Icon, label }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 transition-colors"
                style={{ color: active ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.45)' }}
              >
                {/* Active indicator bar */}
                {active && (
                  <motion.span
                    layoutId="provider-bottom-active"
                    className="absolute top-0 h-[2px] w-8 rounded-full bg-accent"
                    transition={{ duration: 0.48, ease: EASE }}
                  />
                )}
                <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2 : 1.5} />
                <span className="font-body text-[9px] tracking-[0.12em] uppercase leading-none">{label}</span>
              </Link>
            );
          })}
          </LayoutGroup>

          {/* More tab — only shown when there are overflow items */}
          {overflowNav.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors relative"
              style={{ color: overflowNav.some(n => isActive(n.to)) ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.45)' }}
              aria-label="More navigation"
            >
              {overflowNav.some(n => isActive(n.to)) && (
                <span
                  className="absolute top-0 h-[2px] w-8 rounded-full"
                  style={{ background: 'hsl(var(--accent))' }}
                />
              )}
              <MoreHorizontal className="w-5 h-5 shrink-0" strokeWidth={1.5} />
              <span className="font-body text-[9px] tracking-[0.12em] uppercase leading-none">More</span>
            </button>
          )}
        </div>
      </div>

      {/* ── More sheet (mobile) ────────────────────────────────────── */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="more-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.36, ease: EASE }}
              className="md:hidden fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />

            {/* Sheet — theme class applied directly so CSS vars always resolve correctly */}
            <motion.div
              key="more-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Admin menu"
              initial={{ y: '105%', opacity: 0, filter: 'blur(10px)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
              exit={{ y: '105%', opacity: 0, filter: 'blur(8px)' }}
              transition={{ duration: 0.64, ease: EASE }}
              className={`${theme !== 'light' ? theme : ''} md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/92 border-t border-white/10 rounded-t-[1.75rem] shadow-[0_-28px_100px_hsl(var(--foreground)/0.14)] backdrop-blur-2xl`}
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-foreground/20" />
              </div>

              {/* Sheet header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-foreground/[0.08]">
                <div>
                  <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/50 mb-0.5">
                    Avalon Admin
                  </p>
                  <p className="font-body text-[13px] font-medium text-foreground">
                    {user?.name || 'Provider'} &nbsp;
                    <span className="text-[10px] tracking-[0.15em] uppercase text-accent border border-accent/40 px-1.5 py-0.5 rounded-full">
                      {ROLE_BADGE[role] || 'Staff'}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.06] text-foreground/60 hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              {/* Overflow nav items */}
              <motion.nav
                initial="hidden"
                animate="show"
                exit="hidden"
                variants={{
                  hidden: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
                  show: { transition: { staggerChildren: 0.045, delayChildren: 0.12 } },
                }}
                className="px-3 py-3"
              >
                <p className="px-3 mb-2 text-[9px] tracking-[0.3em] uppercase text-foreground/50 font-body">
                  More
                </p>
                {overflowNav.map(({ to, icon: Icon, label }) => {
                  const active = isActive(to);
                  return (
                    <motion.div
                      key={to}
                      variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } } }}
                    >
                      <Link
                        to={to}
                        onClick={() => setMoreOpen(false)}
                        className={`av-glass-sweep relative flex items-center gap-3.5 overflow-hidden rounded-xl px-3 py-3.5 mb-0.5 transition-all ${
                          active ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-foreground/[0.05]'
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 shrink-0 ${active ? 'text-accent' : 'text-foreground/60'}`}
                          strokeWidth={1.5}
                        />
                        <span className="font-body text-[15px] tracking-wide">{label}</span>
                        {active
                          ? <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                          : <ChevronRight className="ml-auto w-4 h-4 text-foreground/25" strokeWidth={1.5} />
                        }
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.nav>

              {/* Sheet footer */}
              <div className="px-3 pt-1 pb-1 border-t border-foreground/[0.08] space-y-0.5">
                <Link
                  to="/"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3.5 px-3 py-3 rounded-xl text-foreground/70 hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                  <span className="font-body text-[13px]">Back to site</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3.5 w-full px-3 py-3 rounded-xl text-red-400/80 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                  <span className="font-body text-[13px]">Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
