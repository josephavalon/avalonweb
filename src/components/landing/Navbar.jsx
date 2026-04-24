import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon, Sunset, Flame, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const THEMES = ['dark', 'light', 'golden', 'niners', 'dubs'];
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
    document.documentElement.classList.remove('dark', 'golden');
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

  const ThemeIcon = theme === 'dark' ? Sun : theme === 'light' ? Moon : theme === 'niners' ? Flame : theme === 'dubs' ? Zap : Sunset;

  // Always route home and scroll to top — even when user is already on "/"
  // (React Router's <Link to="/"> is a no-op from "/"; this forces the reset).
  const handleLogoClick = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
          <a href="/#how-it-works" className={linkClass}>How It Works</a>
          <a href="/#treatments" className={linkClass}>Treatments</a>
          <a href="/#membership" className={linkClass}>Membership</a>
          <a href="/#events" className={linkClass}>News & Events</a>
        </div>

        {/* Theme toggle and Login far right */}
        <div className="flex items-center gap-6">
          <button
            onClick={cycleTheme}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`Switch theme — currently ${theme}`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="w-4 h-4" />
          </button>
          <Link to="/apply" className={linkClass}>Apply</Link>
        </div>
      </div>

      {/* Mobile */}
      <div className={`md:hidden flex items-center justify-between px-5 transition-all duration-500 ease-editorial ${
        scrolled ? 'h-12' : 'h-14'
      }`}>
        <Link to="/" onClick={handleLogoClick} className="font-heading text-[15px] tracking-[0.2em] text-foreground">AV</Link>
        <div className="flex items-center gap-3">
          <button
            onClick={cycleTheme}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`Switch theme — currently ${theme}`}
            title={`Theme: ${theme}`}
          >
            <ThemeIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-foreground p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
              <a href="/#how-it-works" className="block text-sm tracking-widest text-foreground hover:text-foreground font-body uppercase">How It Works</a>
              <a href="/#treatments" className="block text-sm tracking-widest text-foreground hover:text-foreground font-body uppercase">Treatments</a>
              <a href="/#membership" className="block text-sm tracking-widest text-foreground hover:text-foreground font-body uppercase">Membership</a>
              <a href="/#events" className="block text-sm tracking-widest text-foreground hover:text-foreground font-body uppercase">News & Events</a>
              <Link to="/apply" className="block text-sm tracking-widest text-accent hover:text-accent/80 font-body uppercase">Apply</Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}