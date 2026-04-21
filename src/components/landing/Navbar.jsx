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

  const linkClass = "text-[11px] tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors font-body uppercase whitespace-nowrap";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${scrolled ? 'bg-background/95 backdrop-blur-md border-b border-border' : 'bg-transparent'}`}>

      {/* Desktop — logo + links left | login far right */}
      <div className="hidden lg:flex items-center justify-between max-w-7xl mx-auto px-8 h-14">

        {/* Left: Logo + Nav links */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-5 h-5 rounded-full border border-foreground/60 flex items-center justify-center">
              <div className="w-1 h-1 rounded-full bg-accent" />
            </div>
            <span className="font-heading text-[15px] tracking-[0.25em] text-foreground">AVALON VITALITY</span>
          </Link>
          <a href="#membership" className={linkClass}>Membership</a>
          <Link to="/services/iv-vitamins" className={linkClass}>IV Vitamins</Link>
          <Link to="/services/nad" className={linkClass}>NAD+</Link>
          <Link to="/services/cbd" className={linkClass}>CBD</Link>
          <Link to="/services/exosomes" className={linkClass}>Exosomes</Link>
          <Link to="/our-story" className={linkClass}>About</Link>
          <a href="/#faq" className={linkClass}>FAQs</a>
        </div>

        {/* Right: Login */}
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
            <div className="px-6 py-6 space-y-4">
              <a href="#membership" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">Membership</a>
              <Link to="/services/iv-vitamins" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">IV Vitamins</Link>
              <Link to="/services/nad" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">NAD+</Link>
              <Link to="/services/cbd" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">CBD</Link>
              <Link to="/services/exosomes" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">Exosomes</Link>
              <Link to="/our-story" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">About</Link>
              <a href="/#faq" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">FAQs</a>
              <a href="#" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">Login</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}