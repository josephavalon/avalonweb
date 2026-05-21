import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Menu, Sun, Moon, Sunset, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE, premiumTap } from '@/lib/motion';
import { useAuthStore } from '@/lib/useAuthStore';

const Thirty = (props) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
    <text x="12" y="19.5" textAnchor="middle" fontSize="22" fontWeight="900" fill="currentColor" fontFamily="'Bebas Neue', 'Impact', 'Arial Black', sans-serif" letterSpacing="0.02em">30</text>
  </svg>
);

const THEMES = ['dark', 'light', 'golden', 'dubs'];
const THEME_STORAGE_KEY = 'avalon.theme';

const readInitialTheme = () => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && THEMES.includes(stored)) return stored;
  } catch {}
  return 'dark';
};


const mainLinks = [
  { to: '/menu', label: 'Menu' },
  { to: '/subscription', label: 'Subscription' },
  { to: '/events', label: 'Launches' },
  { to: '/service-area', label: 'Locations' },
];

const dashboardPathFor = (user) => {
  if (!user) return '/login';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'provider') return '/provider/shift';
  return '/members/dashboard';
};

export default function Navbar({ showBack = false }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(readInitialTheme);
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
    } catch {}
  }, [theme]);

  const cycleTheme = () => {
    setTheme(prev => THEMES[(THEMES.indexOf(prev) + 1) % THEMES.length]);
  };

  const ThemeIcon = theme === 'dark' ? Sun : theme === 'light' ? Moon : theme === 'dubs' ? Thirty : Sunset;

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

  const linkClass = "inline-flex items-center text-xs tracking-[0.18em] text-foreground hover:text-foreground transition-colors font-body uppercase whitespace-nowrap leading-none";

  return (
    <motion.nav
      initial={{ opacity: 0, y: -18, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 1, delay: 0.08, ease: EASE }}
      className={`fixed left-4 right-4 z-40 rounded-3xl transition-all duration-700 ease-editorial ${
      scrolled
        ? 'top-2 bg-background/60 backdrop-blur-2xl border border-foreground/10 shadow-lg shadow-black/25'
        : 'top-4 bg-background/60 backdrop-blur-2xl border border-foreground/10'
    }`}>

      {/* Desktop — 3-column grid: 1fr | auto | 1fr guarantees true center at every width */}
      <div className={`hidden md:grid md:grid-cols-[1fr_auto_1fr] items-center px-8 transition-all duration-500 ease-editorial ${
        scrolled ? 'h-14' : 'h-16'
      }`}>

        {/* Col 1 — logo, left-aligned */}
        <div className="flex items-center gap-4">
          {showBack && (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 text-foreground transition-colors hover:bg-foreground/10"
              aria-label="Go back"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </button>
          )}
          <Link to="/" onClick={handleLogoClick} className="shrink-0 leading-none">
            <span className="block font-heading text-[17px] tracking-[0.22em] text-foreground leading-none">AVALON</span>
            <span className="block font-body text-[8px] tracking-[0.38em] text-foreground/60 uppercase mt-0.5">VITALITY</span>
          </Link>
        </div>

        {/* Col 2 — nav links, auto width, inherently centered */}
        <div className="flex items-center gap-8">
          {mainLinks.map((link) => (
            <Link key={link.to} to={link.to} className={linkClass}>{link.label}</Link>
          ))}
          {user ? (
            <Link to={dashboardPathFor(user)} className={linkClass}>Dashboard</Link>
          ) : (
            <Link to="/login" className={linkClass}>Login</Link>
          )}
        </div>

        {/* Col 3 — theme toggle + BUY NOW CTA, right-aligned */}
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
          <button
            onClick={cycleTheme}
            className="theme-toggle-btn p-1.5 rounded-full hover:bg-white/10 transition-all duration-base ease-editorial text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`Switch theme — currently ${theme}`}
            title={`Theme: ${theme}`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ opacity: 0, rotate: -24, scale: 0.82 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 24, scale: 0.82 }}
                transition={{ duration: 0.32, ease: EASE }}
                className="block"
              >
                <ThemeIcon className="w-4 h-4" />
              </motion.span>
            </AnimatePresence>
          </button>
          <Link
            to="/book"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 font-body text-[11px] font-semibold tracking-[0.22em] uppercase text-background transition-opacity hover:opacity-85"
          >
            Buy Now
            <ArrowLeft className="h-3.5 w-3.5 rotate-180" strokeWidth={2.2} />
          </Link>
        </div>
      </div>

      {/* Mobile bar */}
      <div className={`md:hidden flex items-center justify-between px-5 transition-all duration-500 ease-editorial ${
        scrolled ? 'h-12' : 'h-14'
      }`}>
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              type="button"
              onClick={goBack}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/10 text-foreground"
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
        <div className="flex items-center gap-3">
          <button
            onClick={cycleTheme}
            className="theme-toggle-btn p-1.5 rounded-full hover:bg-white/10 transition-all duration-base ease-editorial text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Switch theme — currently ${theme}`}
            title={`Theme: ${theme}`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ opacity: 0, rotate: -24, scale: 0.82 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 24, scale: 0.82 }}
                transition={{ duration: 0.32, ease: EASE }}
                className="block"
              >
                <ThemeIcon className="w-5 h-5" />
              </motion.span>
            </AnimatePresence>
          </button>
          <motion.button
            onClick={() => setMobileOpen(!mobileOpen)}
            whileTap={premiumTap}
            className="mobile-menu-btn text-foreground p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
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
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0, filter: 'blur(8px)' }}
              animate={{ opacity: 1, height: 'auto', filter: 'blur(0px)' }}
              exit={{ opacity: 0, height: 0, filter: 'blur(8px)' }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <div className="border-t border-white/[0.08] mx-4 mb-1" />
              <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={{
                  hidden: { transition: { staggerChildren: 0.035, staggerDirection: -1 } },
                  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.08 } },
                }}
                className="px-6 py-4 flex flex-col items-end gap-4"
              >
                {showBack && (
                  <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } } }}>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        goBack();
                      }}
                      className="block text-sm tracking-widest text-foreground hover:text-foreground/70 font-body uppercase transition-colors text-right"
                    >
                      Back
                    </button>
                  </motion.div>
                )}

                {mainLinks.map((item) => (
                  <motion.div
                    key={item.to}
                    variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } } }}
                  >
                    <Link
                      to={item.to}
                      onClick={close}
                      className="block text-sm tracking-widest text-foreground hover:text-foreground/70 font-body uppercase transition-colors text-right"
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
                <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } } }}>
                  <Link
                    to="/book"
                    onClick={close}
                    className="block text-sm tracking-widest text-foreground hover:text-foreground/70 font-body uppercase transition-colors text-right"
                  >
                    Buy Now
                  </Link>
                </motion.div>

                <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } } }}>
                  {user ? (
                    <Link
                      to={dashboardPathFor(user)}
                      onClick={close}
                      className="block text-sm tracking-widest text-foreground hover:text-foreground/70 font-body uppercase transition-colors text-right"
                    >
                      Dashboard
                    </Link>
                  ) : (
                    <Link
                      to="/login"
                      onClick={close}
                      className="block text-sm tracking-widest text-foreground hover:text-foreground/70 font-body uppercase transition-colors text-right"
                    >
                      Login
                    </Link>
                  )}
                </motion.div>

                {user && (
                  <motion.div variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } } }}>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block text-sm tracking-widest text-foreground hover:text-foreground/70 font-body uppercase transition-colors text-right"
                    >
                      Sign Out
                    </button>
                  </motion.div>
                )}

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}
