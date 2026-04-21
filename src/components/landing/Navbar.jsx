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

  const linkClass = "text-[11px] tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors font-body uppercase whitespace-nowrap";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${scrolled ? 'bg-background/95 backdrop-blur-md border-b border-border' : 'bg-transparent'}`}>

      {/* Desktop */}
      <div className="hidden lg:flex items-center justify-between max-w-7xl mx-auto px-8 h-14">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-5 h-5 rounded-full border border-foreground/60 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-accent" />
          </div>
          <span className="font-heading text-[15px] tracking-[0.25em] text-foreground">AVALON VITALITY</span>
        </Link>

        {/* Center links */}
        <div className="flex items-center gap-10">
          <a href="#membership" className={linkClass}>Membership</a>
          <Link to="/our-story" className={linkClass}>About</Link>
          <a href="#faq" className={linkClass}>FAQs</a>
        </div>

        {/* Login far right */}
        <a href="#" className={linkClass}>Login</a>
      </div>

      {/* Mobile */}
      <div className="lg:hidden flex items-center justify-between max-w-7xl mx-auto px-5 h-14">
        <Link to="/" className="font-heading text-[15px] tracking-[0.2em] text-foreground">AVALON VITALITY</Link>
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
            className="lg:hidden bg-background border-t border-border overflow-hidden"
          >
            <div className="px-6 py-6 space-y-5">
              <a href="#membership" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">Membership</a>
              <Link to="/our-story" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">About</Link>
              <a href="#faq" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">FAQs</a>
              <a href="#" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">Login</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}