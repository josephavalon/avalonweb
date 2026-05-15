import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon, Sunset, ChevronDown, Droplets, Zap, ShieldCheck, Sparkles, Heart, FlaskConical, Circle, CircleDot, SlidersHorizontal, Building2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  return 'golden';
};

// Therapy submenu items
const THERAPY_ITEMS = [
  { icon: Droplets,    label: 'Hydration',     href: '/newsletter' },
  { icon: Zap,         label: 'Energy',        href: '/newsletter' },
  { icon: ShieldCheck, label: 'Immunity',      href: '/newsletter' },
  { icon: Heart,       label: 'Recovery',      href: '/newsletter' },
  { icon: Sparkles,    label: 'Beauty',        href: '/newsletter' },
  { icon: FlaskConical, label: 'NAD+',         href: '/services/nad' },
];

// Membership submenu items
const MEMBERSHIP_ITEMS = [
  { icon: Circle,           label: 'Starter',  sub: '1 IV/mo',   href: '/newsletter' },
  { icon: CircleDot,        label: 'Premium',  sub: '2 IVs/mo',  href: '/newsletter' },
  { icon: Sparkles,         label: 'VIP',      sub: '4 IVs/mo',  href: '/newsletter' },
  { icon: SlidersHorizontal, label: 'Custom',  sub: 'Concierge', href: '/newsletter' },
];

// Channel submenu items
const CHANNEL_ITEMS = [
  { icon: Building2, label: 'Corporate',  sub: 'Teams & offices',      href: '/corporate' },
  { icon: Calendar,  label: 'Events',     sub: 'Activations & venues', href: '/events'    },
  { icon: Sparkles,  label: 'VIPs',       sub: 'Performance recovery', href: '/athlete'   },
];

// Expandable mobile nav item with a glass submenu
function MobileExpandable({ label, items, onClose }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-end gap-2 text-sm tracking-widest text-foreground font-body uppercase transition-colors"
        aria-expanded={open}
      >
        {label}
        <ChevronDown
          className="w-3.5 h-3.5 text-foreground/40 transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-2 rounded-2xl border border-foreground/10 bg-white/[0.04] backdrop-blur-sm overflow-hidden">
              {items.map((item, i) => (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={onClose}
                  className={`flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.05] transition-colors ${
                    i < items.length - 1 ? 'border-b border-white/[0.05]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon className="w-3.5 h-3.5 text-accent shrink-0" strokeWidth={1.5} />
                    <span className="font-body text-xs tracking-[0.15em] uppercase text-foreground">{item.label}</span>
                  </div>
                  {item.sub && (
                    <span className="font-body text-[9px] tracking-[0.15em] uppercase text-foreground/35">{item.sub}</span>
                  )}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Desktop dropdown with hover delay
function DesktopDropdown({ label, items }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  const handleEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs tracking-[0.18em] text-foreground hover:text-foreground transition-colors font-body uppercase whitespace-nowrap leading-none focus:outline-none"
      >
        {label}
        <ChevronDown
          className="w-3 h-3 text-foreground/50 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          strokeWidth={2}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 min-w-[210px] rounded-2xl border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden z-50"
          >
            {items.map((item, i) => (
              <Link
                key={item.label}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors ${
                  i < items.length - 1 ? 'border-b border-white/[0.05]' : ''
                }`}
              >
                <item.icon className="w-3.5 h-3.5 text-accent shrink-0" strokeWidth={1.5} />
                <div className="flex flex-col">
                  <span className="font-body text-xs tracking-[0.12em] uppercase text-foreground">{item.label}</span>
                  {item.sub && (
                    <span className="font-body text-[9px] text-foreground/40">{item.sub}</span>
                  )}
                </div>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(readInitialTheme);
  const location = useLocation();

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

  const linkClass = "inline-flex items-center text-xs tracking-[0.18em] text-foreground hover:text-foreground transition-colors font-body uppercase whitespace-nowrap leading-none";

  return (
    <nav className={`fixed left-4 right-4 z-40 rounded-3xl transition-all duration-500 ease-editorial ${
      scrolled
        ? 'top-2 bg-background/60 backdrop-blur-2xl border border-foreground/10 shadow-lg shadow-black/25'
        : 'top-4 bg-background/60 backdrop-blur-2xl border border-foreground/10'
    }`}>

      {/* Desktop */}
      <div className={`hidden md:flex items-center px-8 transition-all duration-500 ease-editorial ${
        scrolled ? 'h-14' : 'h-16'
      }`}>

        {/* Left — flex-1, content left-aligned. Equal flex-1 on both flanks
            guarantees the center block sits at the true nav midpoint */}
        <div className="flex-1 flex items-center">
          <Link to="/" onClick={handleLogoClick} className="shrink-0">
            <span className="font-heading text-[15px] tracking-[0.25em] text-foreground">AV</span>
          </Link>
        </div>

        {/* Center — natural width, no flex. Perfectly centered because flanks are equal */}
        <div className="flex items-center gap-8">
          <Link to="/#how-it-works" className={linkClass}>Process</Link>
          <DesktopDropdown label="Therapies" items={THERAPY_ITEMS} />
          <DesktopDropdown label="Membership" items={MEMBERSHIP_ITEMS} />
        </div>

        {/* Right — flex-1, content right-aligned */}
        <div className="flex-1 flex items-center justify-end gap-4">
          <button
            onClick={cycleTheme}
            className="theme-toggle-btn p-1.5 rounded-full hover:bg-white/10 transition-colors text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`Switch theme — currently ${theme}`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="w-4 h-4" />
          </button>
          <Link to="/login" className={linkClass}>Login</Link>
        </div>
      </div>

      {/* Mobile bar */}
      <div className={`md:hidden flex items-center justify-between px-5 transition-all duration-500 ease-editorial ${
        scrolled ? 'h-12' : 'h-14'
      }`}>
        <Link to="/" onClick={handleLogoClick} className="av-logo font-heading text-[22px] leading-none tracking-[0.22em] text-foreground">AV</Link>
        <div className="flex items-center gap-3">
          <button
            onClick={cycleTheme}
            className="theme-toggle-btn p-1.5 rounded-full hover:bg-white/10 transition-colors text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Switch theme — currently ${theme}`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="mobile-menu-btn text-foreground p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <div className="md:hidden overflow-hidden rounded-b-3xl">
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="border-t border-white/[0.08] mx-4 mb-1" />
              <div className="px-6 py-4 flex flex-col items-end gap-4">

                <Link
                  to="/#how-it-works"
                  onClick={close}
                  className="block text-sm tracking-widest text-foreground hover:text-foreground/70 font-body uppercase transition-colors text-right"
                >
                  Process
                </Link>

                <Link
                  to="/newsletter"
                  onClick={close}
                  className="block text-sm tracking-widest text-foreground hover:text-foreground/70 font-body uppercase transition-colors text-right"
                >
                  Therapies
                </Link>

                <Link
                  to="/newsletter"
                  onClick={close}
                  className="block text-sm tracking-widest text-foreground hover:text-foreground/70 font-body uppercase transition-colors text-right"
                >
                  Membership
                </Link>

                <Link
                  to="/login"
                  onClick={close}
                  className="block text-sm tracking-widest text-foreground hover:text-foreground/70 font-body uppercase transition-colors text-right"
                >
                  Login
                </Link>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
