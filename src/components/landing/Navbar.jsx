import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon, Sunset } from 'lucide-react';
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
          <Link to="/newsletter" className={linkClass}>Therapies</Link>
          <Link to="/membership" className={linkClass}>Membership</Link>
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
        <Link to="/" onClick={handleLogoClick} className="av-logo flex items-center h-full font-heading text-[22px] leading-none tracking-[0.22em] text-foreground translate-y-[1px]">AV</Link>
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
