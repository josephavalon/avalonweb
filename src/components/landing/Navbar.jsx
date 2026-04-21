import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const activeServices = [
  { label: 'IV Vitamins', href: '/services/iv-vitamins' },
  { label: 'NAD+', href: '/services/nad' },
  { label: 'CBD', href: '/services/cbd' },
  { label: 'Exosomes', href: '/services/exosomes' },
];

const comingSoon = [
  'Recovery Devices', 'Protocols', 'Peptides', 'Blood Draws',
  'Genetic Testing', 'Sexual Wellness', 'HRT', 'Supplements', 'Diet Agent',
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setServicesOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setServicesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const linkClass = "text-[11px] tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors font-body uppercase";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${scrolled ? 'bg-background/95 backdrop-blur-md border-b border-border' : 'bg-transparent'}`}>
      {/* Desktop */}
      <div className="hidden lg:flex items-center justify-between max-w-7xl mx-auto px-8 h-14">
        {/* Left: Logo + Nav links */}
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded-full border border-foreground/60 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            </div>
            <span className="font-heading text-base tracking-[0.25em] text-foreground">AVALON VITALITY</span>
          </Link>

          <div className="flex items-center gap-7">
            <a href="#membership" className={linkClass}>Membership</a>

            {/* Services Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setServicesOpen(!servicesOpen)}
                className={`flex items-center gap-1 ${linkClass}`}
              >
                Services <ChevronDown className={`w-3 h-3 transition-transform ${servicesOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {servicesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.18 }}
                    className="absolute top-full left-0 mt-3 w-56 bg-card border border-border rounded overflow-hidden shadow-2xl"
                  >
                    <div className="p-2">
                      <p className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase px-3 py-2 font-body">Available Now</p>
                      {activeServices.map((s) => (
                        <Link key={s.href} to={s.href} className="block px-3 py-2 text-[11px] tracking-wider text-foreground hover:bg-secondary hover:text-accent transition-colors font-body uppercase">
                          {s.label}
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-border p-2">
                      <p className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase px-3 py-2 font-body flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> Coming Soon
                      </p>
                      <div className="grid grid-cols-2 gap-0.5">
                        {comingSoon.map((s) => (
                          <span key={s} className="px-3 py-1.5 text-[10px] tracking-wide text-muted-foreground/40 font-body uppercase cursor-not-allowed">{s}</span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link to="/our-story" className={linkClass}>About</Link>
            <a href="/#faq" className={linkClass}>FAQs</a>
          </div>
        </div>

        {/* Right: Login */}
        <a href="#" className={linkClass}>Login</a>
      </div>

      {/* Mobile */}
      <div className="lg:hidden flex items-center justify-between max-w-7xl mx-auto px-5 h-14">
        <Link to="/" className="font-heading text-base tracking-[0.2em] text-foreground">AVALON VITALITY</Link>
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

              <div>
                <button
                  onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                  className="flex items-center gap-2 text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase w-full"
                >
                  Services <ChevronDown className={`w-3 h-3 transition-transform ${mobileServicesOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {mobileServicesOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 pl-4 space-y-3 overflow-hidden"
                    >
                      {activeServices.map((s) => (
                        <Link key={s.href} to={s.href} className="block text-sm tracking-wider text-foreground hover:text-accent font-body uppercase">{s.label}</Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

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