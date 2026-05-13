import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Users, Calendar, FileText,
  BarChart3, Package, Shield, Mail, LogOut,
  X, ChevronRight, Syringe, FileBarChart2,
  Sun, Moon, Sunset, MoreHorizontal, ArrowLeft,
  ClipboardList, UserCheck, CreditCard, Star,
  Archive, MessageSquare, TrendingUp, Settings,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '@/lib/useAuthStore';

// ─── Theme cycle — mirrors public site Navbar ──────────────────────────────
const THEMES = ['dark', 'light', 'golden', 'dubs'];
const THEME_KEY = 'avalon.theme';

const Thirty = (props) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <text x="12" y="19.5" textAnchor="middle" fontSize="22" fontWeight="900"
      fill="currentColor"
      fontFamily="'Bebas Neue', 'Impact', 'Arial Black', sans-serif"
      letterSpacing="0.02em">30</text>
  </svg>
);

const readInitialTheme = () => {
  try {
    const s = window.localStorage.getItem(THEME_KEY);
    if (s && THEMES.includes(s)) return s;
  } catch {}
  return 'dark';
};

// ─── Nav items ─────────────────────────────────────────────────────────────
const NAV = [
  // Primary — always visible
  { to: '/provider/dashboard',      icon: Zap,             label: 'Command',    roles: ['admin', 'superadmin'], primary: true },
  { to: '/provider/appointments',   icon: ClipboardList,   label: 'Requests',   roles: ['admin', 'superadmin'], primary: true, badge: 8 },
  { to: '/provider/clients',        icon: Users,           label: 'Clients',    roles: ['admin', 'superadmin'], primary: true },
  { to: '/provider/staff',          icon: UserCheck,       label: 'Nurses',     roles: ['admin', 'superadmin'], primary: true },
  // Nurse shift view
  { to: '/provider/shift',          icon: Syringe,         label: 'My Shift',   roles: ['provider'], primary: true },
  // Extended — overflow on mobile
  { to: '/provider/invoicing',      icon: CreditCard,      label: 'Clearance',  roles: ['admin', 'superadmin'] },
  { to: '/provider/accounting',     icon: FileText,        label: 'Payments',   roles: ['admin', 'superadmin'] },
  { to: '/provider/services',       icon: Star,            label: 'Memberships',roles: ['admin', 'superadmin'] },
  { to: '/provider/communications',  icon: MessageSquare,   label: 'Follow-Ups', roles: ['admin', 'superadmin'] },
  { to: '/provider/reports',        icon: TrendingUp,      label: 'Reports',    roles: ['admin', 'superadmin'] },
  { to: '/provider/settings',       icon: Settings,        label: 'Settings',   roles: ['admin', 'superadmin'] },
];

// Bottom tab bar — primary tabs only
const BOTTOM_TAB_COUNT = 4;

const ROLE_BADGE = {
  superadmin: 'Superadmin',
  admin:      'Admin',
  provider:   'Nurse',
  client:     'Client',
};

const EASE = [0.16, 1, 0.3, 1];

// ─── Component ─────────────────────────────────────────────────────────────
export default function AdminLayout({ children }) {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme, setTheme] = useState(readInitialTheme);

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
    try { window.localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  const cycleTheme = () =>
    setTheme(prev => THEMES[(THEMES.indexOf(prev) + 1) % THEMES.length]);

  const ThemeIcon =
    theme === 'dark'   ? Sun    :
    theme === 'light'  ? Moon   :
    theme === 'dubs'   ? Thirty :
    Sunset;

  const role = user?.role || 'provider';
  const visibleNav = NAV.filter(n => n.roles.includes(role));
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
      <div className="px-6 pt-6 pb-5 border-b border-foreground/[0.06]">
        <Link to="/" className="font-heading text-[15px] tracking-[0.3em] text-foreground block mb-4">
          AV
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
        {visibleNav.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all text-sm"
            style={{
              background:  isActive(to) ? 'hsl(var(--accent) / 0.1)' : 'transparent',
              color:       isActive(to) ? 'hsl(var(--accent))'       : 'hsl(var(--foreground))',
              borderLeft:  isActive(to) ? '2px solid hsl(var(--accent))' : '2px solid transparent',
            }}
          >
            <Icon
              className="w-4 h-4 shrink-0"
              strokeWidth={1.5}
              style={{ color: isActive(to) ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.6)' }}
            />
            <span className="font-body text-[13px] tracking-wide">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 border-t border-foreground/[0.06] pt-4 space-y-0.5">
        <button
          onClick={cycleTheme}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-foreground/60 hover:text-foreground transition-colors"
          aria-label={`Theme: ${theme}`}
        >
          <ThemeIcon className="w-4 h-4 shrink-0" />
          <span className="font-body text-[12px] capitalize">{theme} theme</span>
        </button>
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
    <div className="min-h-screen flex bg-background text-foreground">

      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 fixed left-0 top-0 h-full z-30 border-r border-foreground/[0.06] bg-foreground/[0.04]">
        <SidebarContent />
      </aside>

      {/* ── Main content area ──────────────────────────────────────── */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-foreground/[0.06] bg-background sticky top-0 z-20">
          {/* Role badge */}
          <div className="flex items-center gap-2">
            <span className="font-heading text-[15px] tracking-[0.3em] text-foreground">AV</span>
            <span className="text-[9px] tracking-[0.2em] uppercase px-1.5 py-0.5 rounded-full border border-accent/40 text-accent font-body">
              {ROLE_BADGE[role] || 'Staff'}
            </span>
          </div>
          {/* User + theme + sign out */}
          <div className="flex items-center gap-3">
            <p className="font-body text-[11px] text-foreground/50 tracking-wide hidden xs:block">
              {user?.name?.split(' ')[0] || ''}
            </p>
            <button
              onClick={cycleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-full text-foreground/50 hover:text-foreground transition-colors"
              aria-label={`Theme: ${theme}`}
            >
              <ThemeIcon className="w-4 h-4" />
            </button>
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
        <main className="flex-1 p-5 md:p-8 max-w-[1280px] w-full pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ──────────────────────────────────── */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background border-t border-foreground/[0.08]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      >
        <div className="flex items-stretch">
          {/* Primary tabs */}
          {bottomTabs.map(({ to, icon: Icon, label }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
                style={{ color: active ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.45)' }}
              >
                {/* Active indicator bar */}
                <span
                  className="absolute top-0 h-[2px] w-8 rounded-full transition-opacity duration-300"
                  style={{
                    background: 'hsl(var(--accent))',
                    opacity: active ? 1 : 0,
                  }}
                />
                <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2 : 1.5} />
                <span className="font-body text-[9px] tracking-[0.12em] uppercase leading-none">{label}</span>
              </Link>
            );
          })}

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
              transition={{ duration: 0.25, ease: EASE }}
              className="md:hidden fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="more-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.38, ease: EASE }}
              className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background border-t border-foreground/[0.1] rounded-t-2xl"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-foreground/20" />
              </div>

              {/* Sheet header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-foreground/[0.06]">
                <div>
                  <p className="font-body text-[10px] tracking-[0.25em] uppercase text-foreground/40 mb-0.5">
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
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-foreground/[0.05] text-foreground/50 hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              {/* Overflow nav items */}
              <nav className="px-3 py-3">
                <p className="px-3 mb-2 text-[9px] tracking-[0.3em] uppercase text-foreground/35 font-body">
                  More
                </p>
                {overflowNav.map(({ to, icon: Icon, label }) => {
                  const active = isActive(to);
                  return (
                    <Link
                      key={to}
                      to={to}
                      className="flex items-center gap-3.5 px-3 py-3 rounded-xl mb-0.5 transition-all"
                      style={{
                        background: active ? 'hsl(var(--accent) / 0.1)' : 'transparent',
                        color:      active ? 'hsl(var(--accent))' : 'hsl(var(--foreground))',
                      }}
                    >
                      <Icon
                        className="w-5 h-5 shrink-0"
                        strokeWidth={1.5}
                        style={{ color: active ? 'hsl(var(--accent))' : 'hsl(var(--foreground) / 0.55)' }}
                      />
                      <span className="font-body text-[14px] tracking-wide">{label}</span>
                      {active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Sheet footer */}
              <div className="px-3 pt-1 pb-1 border-t border-foreground/[0.06] space-y-0.5">
                <button
                  onClick={() => { cycleTheme(); }}
                  className="flex items-center gap-3.5 w-full px-3 py-3 rounded-xl text-foreground/55 hover:text-foreground transition-colors"
                >
                  <ThemeIcon className="w-5 h-5 shrink-0" />
                  <span className="font-body text-[13px] capitalize">{theme} theme</span>
                </button>
                <Link
                  to="/"
                  className="flex items-center gap-3.5 px-3 py-3 rounded-xl text-foreground/55 hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                  <span className="font-body text-[13px]">Back to site</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3.5 w-full px-3 py-3 rounded-xl text-foreground/55 hover:text-red-400 transition-colors"
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
