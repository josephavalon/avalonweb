import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const linkClass = "text-[11px] tracking-[0.18em] text-foreground/70 hover:text-foreground transition-colors font-body uppercase whitespace-nowrap";

  return (
    <nav className="fixed top-4 left-4 right-4 z-40 backdrop-blur-md bg-background/30 border border-white/10 rounded-3xl transition-all duration-500">

      {/* Desktop */}
      <div className="hidden md:flex items-center justify-between px-8 h-16">

        {/* Logo */}
        <Link to="/" className="font-heading text-[15px] tracking-[0.25em] text-foreground shrink-0">
          AV
        </Link>

        {/* Center links */}
        <div className="flex items-center gap-10">
          <a href="#how-it-works" className={linkClass}>How It Works</a>
          <a href="#membership" className={linkClass}>Membership</a>
          <a href="#events" className={linkClass}>For Events</a>
        </div>

        {/* Login far right */}
        <a href="/membership" className={linkClass}>Login</a>
      </div>

      {/* Mobile */}
      <div className="md:hidden flex items-center justify-between px-5 h-14">
        <Link to="/" className="font-heading text-[15px] tracking-[0.2em] text-foreground">AV</Link>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-foreground p-1">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
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
              <a href="#how-it-works" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">How It Works</a>
              <a href="#membership" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">Membership</a>
              <a href="#events" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">For Events</a>
              <a href="/membership" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">Login</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}