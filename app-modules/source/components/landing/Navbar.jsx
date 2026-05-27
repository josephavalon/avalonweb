import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Menu, X } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from '@/components/ui/PageTransitionMotion';
import { EASE, premiumSelectionTransition, premiumTap } from '@/lib/motion';
import { useAuthStore } from '@/lib/useAuthStore';
import PremiumButton from '@/components/ui/PremiumButton';
import SmoothDisclosure from '@/components/ui/SmoothDisclosure';

const THEMES = ['dark', 'light'];
const THEME_STORAGE_KEY = 'avalon.theme';

const readInitialTheme = () => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && THEMES.includes(stored)) return stored;
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[navbar-theme-read]', err);
  }
  return 'dark';
};


const mainLinks = [
  { to: '/protocols', label: 'Protocols' },
  { to: '/subscription', label: 'Plans' },
  { to: '/launches', label: 'Launches' },
];

const dashboardPathFor = (user) => {
  if (!user) return '/login';
  if (user.role === 'admin') return '/admin';
  if (['provider', 'np', 'physician'].includes(user.role)) return '/provider/shift';
  return '/members/dashboard';
};

export default function Navbar({ showBack = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme] = useState(readInitialTheme);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'golden', 'dubs');
    if (theme !== 'light') document.documentElement.classList.add(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (err) {
      if (import.meta.env?.DEV) console.warn('[navbar-theme-write]', err);
    }
  }, [theme]);

  const handleLogoClick = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (e.currentTarget && typeof e.currentTarget.blur === 'function') e.currentTarget.blur();
    }
  };

  const close = () => setMobileOpen(false);
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };
  const handleSignOut = () => {
    signOut();
    close();
    navigate('/login');
  };

  const linkClass = "inline-flex min-h-11 items-center text-xs tracking-[0.18em] text-foreground hover:text-foreground transition-colors font-body uppercase whitespace-nowrap leading-none";
  const isActiveLink = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);
  const mobileLinks = [
    ...mainLinks,
    { to: '/book', label: 'Book', primary: true },
    { to: dashboardPathFor(user), label: user ? 'Dashboard' : 'Login' },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.08, ease: EASE }}
      className={`av-motion-rail fixed left-4 right-4 z-40 rounded-3xl transition-all duration-700 ease-editorial ${
      scrolled
        ? 'top-2 bg-background/60 backdrop-blur-2xl border border-foreground/10 shadow-lg shadow-black/25'
        : 'top-4 bg-background/60 backdrop-blur-2xl border border-foreground/10'
    }`}>

      {/* Desktop — 3-column grid: 1fr | auto | 1fr guarantees true center at every width */}
      <div
        className={`hidden md:grid items-center px-8 transition-all duration-500 ease-editorial ${
        scrolled ? 'h-14' : 'h-16'
        }`}
        style={{ gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)' }}
      >

        {/* Col 1 — logo, left-aligned */}
        <div className="flex items-center gap-4">
          {showBack && (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-foreground/10 text-foreground transition-colors hover:bg-foreground/10"
              aria-label="Go back"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
          <Link to="/" onClick={handleLogoClick} className="inline-flex min-h-11 shrink-0 flex-col justify-center leading-none">
            <span className="block font-heading text-[17px] tracking-[0.22em] text-foreground leading-none">AVALON</span>
            <span className="block font-body text-[8px] tracking-[0.38em] text-foreground/60 uppercase mt-0.5">VITALITY</span>
          </Link>
        </div>

        {/* Col 2 — nav links, auto width, inherently centered */}
        <LayoutGroup id="desktop-nav-links">
          <div className="flex items-center gap-2 rounded-full border border-foreground/[0.07] bg-foreground/[0.025] p-1 backdrop-blur-xl">
            {mainLinks.map((link) => {
              const active = isActiveLink(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative isolate inline-flex min-h-11 items-center overflow-hidden rounded-full px-3 py-2 font-body text-xs uppercase leading-none tracking-[0.18em] transition-colors ${
                    active ? 'text-foreground' : 'text-foreground/58 hover:text-foreground'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="desktop-nav-active"
                      className="absolute inset-0 rounded-full bg-foreground/[0.095] shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12)]"
                      transition={premiumSelectionTransition}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </LayoutGroup>

        {/* Col 3 — account link + booking CTA, right-aligned */}
        <div className="flex items-center justify-end gap-4">
          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              className={`${linkClass} gap-1`}
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.8} />
              Sign Out
            </button>
          )}
          <Link to={dashboardPathFor(user)} className={linkClass}>{user ? 'Dashboard' : 'Login'}</Link>
          <PremiumButton
            as={Link}
            to="/book"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 py-2.5 font-body text-[11px] font-semibold tracking-[0.22em] uppercase text-background transition-opacity hover:opacity-85"
          >
            Book
            <ArrowLeft className="h-3.5 w-3.5 rotate-180" strokeWidth={2.2} />
          </PremiumButton>
        </div>
      </div>

      {/* Mobile bar */}
      <div className={`md:hidden flex items-center justify-between px-4 transition-all duration-500 ease-editorial ${
        scrolled ? 'h-14' : 'h-16'
      }`}>
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              type="button"
              onClick={goBack}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-foreground/10 text-foreground"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
          <Link to="/" onClick={handleLogoClick} className="av-logo flex flex-col justify-center leading-none">
            <span className="font-heading text-[17px] tracking-[0.22em] text-foreground leading-none">AVALON</span>
            <span className="font-body text-[7px] tracking-[0.38em] text-foreground/60 uppercase mt-0.5">VITALITY</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => setMobileOpen(!mobileOpen)}
            whileTap={premiumTap}
            className="mobile-menu-btn flex h-11 w-11 items-center justify-center rounded-full text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={mobileOpen ? 'close' : 'menu'}
                initial={{ opacity: 0, rotate: -18, scale: 0.85 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 18, scale: 0.85 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="block"
              >
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <div className="md:hidden overflow-hidden rounded-b-3xl">
        <SmoothDisclosure open={mobileOpen} className="px-2" innerClassName="pb-2">
              <motion.div
                initial={false}
                animate={mobileOpen ? 'visible' : 'hidden'}
                variants={{
                  hidden: { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
                  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
                }}
                className="relative overflow-hidden rounded-[24px] border border-foreground/[0.10] bg-background/82 p-1.5 shadow-[0_28px_100px_hsl(var(--foreground)/0.10)] backdrop-blur-2xl"
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,hsl(var(--foreground)/0.10),transparent_34%,hsl(var(--accent)/0.08))]" />
                <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-foreground/20" />

                {showBack && (
                  <motion.div
                    className="relative"
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE } } }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        goBack();
                      }}
                      className="flex min-h-[58px] w-full items-center justify-between rounded-2xl border border-foreground/[0.10] bg-foreground/[0.045] px-4 font-body text-[11px] uppercase tracking-[0.22em] text-foreground/74 transition-colors hover:bg-foreground/[0.075] hover:text-foreground"
                    >
                      <span>Back</span>
                      <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </motion.div>
                )}

                <div className="relative grid gap-1.5">
                  {mobileLinks.map((item) => {
                  const active = isActiveLink(item.to);
                  return (
                    <motion.div
                      key={item.to}
                      variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE } } }}
                    >
                      <Link
                        to={item.to}
                        onClick={close}
                        className={`group flex min-h-[58px] items-center justify-between rounded-2xl border px-4 font-body text-[11px] uppercase tracking-[0.24em] transition-all duration-300 ${
                          item.primary
                            ? 'border-foreground/80 bg-foreground text-background hover:opacity-90'
                            : active
                              ? 'border-foreground/[0.18] bg-foreground/[0.075] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.12)]'
                              : 'border-transparent bg-transparent text-foreground/66 hover:border-foreground/[0.10] hover:bg-foreground/[0.055] hover:text-foreground'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className={`h-1.5 w-1.5 rounded-full transition-colors ${
                          item.primary
                            ? 'bg-background/60'
                            : active
                              ? 'bg-accent'
                              : 'bg-foreground/18 group-hover:bg-foreground/42'
                        }`} />
                      </Link>
                    </motion.div>
                  );
                })}
                </div>

                {user && (
                  <motion.div
                    className="relative mt-1"
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.36, ease: EASE } } }}
                  >
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex min-h-[58px] w-full items-center justify-between rounded-2xl border border-foreground/[0.10] bg-foreground/[0.035] px-4 font-body text-[10px] uppercase tracking-[0.22em] text-foreground/52 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                    >
                      <span>Sign Out</span>
                      <LogOut className="h-3.5 w-3.5" strokeWidth={1.7} />
                    </button>
                  </motion.div>
                )}

              </motion.div>
        </SmoothDisclosure>
      </div>
    </motion.nav>
  );
}
