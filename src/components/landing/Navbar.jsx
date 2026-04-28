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
  if (typeof window === 'undefined') return 'dark';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return THEMES.includes(stored) ? stored : 'golden';
};

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(readInitialTheme);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  // Sync <html> class and localStorage to theme state on mount + every change.
  // This fixes the "first click does nothing" bug by guaranteeing the DOM
  // matches the React state before the first user interaction.
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'golden', 'dubs');
    if (theme !== 'light') document.documentElement.classList.add(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // localStorage may be unavailable (private mode, SSR) — non-fatal.
    }
  }, [theme]);

  const cycleTheme = () => {
    setTheme(prev => THEMES[(THEMES.indexOf(prev) + 1) % THEMES.length]);
  };

  const ThemeIcon = theme === 'dark' ? Sun : theme === 'light' ? Moon : theme === 'dubs' ? Thirty : Sunset;

  // Always route home and scroll to top — even when user is already on "/"
  // (React Router's <Link to="/"> is a no-op from "/"; this forces the reset).
  const handleLogoClick = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Clear focus so keyboard users aren't stuck on the nav logo after scroll.
      if (e.currentTarget && typeof e.currentTarget.blur === 'function') e.currentTarget.blur();
    }
  };

  const linkClass = "text-xs tracking-[0.18em] text-foreground hover:text-foreground transition-colors font-body uppercase whitespace-nowrap";

  return (
    <nav className={`fixed left-4 right-4 z-40 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden transition-all duration-500 ease-editorial ${
      scrolled ? 'top-2 bg-background/70 shadow-lg shadow-black/20' : 'top-4 bg-background/30'
    }`}>

      {/* Desktop */}
      <div className={`hidden md:flex items-center justify-between px-8 transition-all duration-500 ease-editorial ${
        scrolled ? 'h-14' : 'h-16'
      }`}>

        {/* Logo */}
        <Link to="/" onClick={handleLogoClick} className="font-heading text-[15px] tracking-[0.25em] text-foreground shrink-0">
          AV
        </Link>

        {/* Center links */}
        <div className="flex items-center gap-10">
          <Link to="/#how-it-works" className={linkClass}>How Avalon Works</Link>
          <Link to="/#treatments" className={linkClass}>Treatments</Link>
          <Link to="/#membership" className={linkClass}>Membership</Link>
          <Link to="/#events" className={linkClass}>Avalon Launches</Link>
        </div>

        {/* Theme toggle and Login far right */}
        <div className="flex items-center gap-6">
          <button
            onClick={cycleTheme}
            className="theme-toggle-btn p-1.5 rounded-full hover:bg-white/10 transition-colors text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`Switch theme — currently ${theme}`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="w-7 h-7 md:w-4 md:h-4" />
          </button>
          <Link to="/apply" className={linkClass}>Apply</Link>
        </div>
      </div>

      {/* Mobile */}
      <div className={`md:hidden flex items-center justify-between px-5 transition-all duration-500 ease-editorial ${
        scrolled ? 'h-12' : 'h-14'
      }`}>
        <Link to="/" onClick={handleLogoClick} className="av-logo font-heading text-[26px] md:text-[15px] leading-none tracking-[0.22em] md:tracking-[0.2em] text-foreground">AV</Link>
        <div className="flex items-center gap-3">
          <button
            onClick={cycleTheme}
            className="theme-toggle-btn p-1.5 rounded-full hover:bg-white/10 transition-colors text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Switch theme — currently ${theme}`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="w-7 h-7 md:w-4 md:h-4" />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="mobile-menu-btn text-foreground p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden backdrop-blur-md bg-background/30 border-t border-white/10 overflow-hidden"
          >
            <div className="px-6 py-6 space-y-5">
              <Link to="/#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm tracking-widest text-foreground hover:text-foreground font-body uppercase">How Avalon Works</Link>
              <Link to="/#treatments" onClick={() => setMobileOpen(false)} className="block text-sm tracking-widest text-foreground hover:text-foreground font-body uppercase">Treatments</Link>
              <Link to="/#membership" onClick={() => setMobileOpen(false)} className="block text-sm tracking-widest text-foreground hover:text-foreground font-body uppercase">Membership</Link>
              <Link to="/#events" onClick={() => setMobileOpen(false)} className="block text-sm tracking-widest text-foreground hover:text-foreground font-body uppercase">Avalon Launches</Link>
              <Link to="/apply" className="block text-sm tracking-widest text-accent hover:text-accent/80 font-body uppercase">Apply</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}