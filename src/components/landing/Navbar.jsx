import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BOOK_URL = 'https://avalonvitality.as.me/schedule/a9d85b1e';

const activeServices = [
  { label: 'IV Vitamins', href: '/services/iv-vitamins' },
  { label: 'NAD+', href: '/services/nad' },
  { label: 'CBD', href: '/services/cbd' },
  { label: 'Exosomes', href: '/services/exosomes' },
];

const comingSoon = [
  'Recovery Devices',
  'Protocols',
  'Peptides',
  'Blood Draws',
  'Genetic Testing',
  'Sexual Wellness',
  'HRT',
  'Supplements',
  'Diet Agent',
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

  return (
    <>
      {/* Promo bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-accent text-accent-foreground text-center text-xs font-body py-2 tracking-widest font-semibold">
        NEW CLIENTS: 15% OFF WITH CODE: WEOUTHERE!
      </div>

      <nav className={`fixed top-8 left-0 right-0 z-40 transition-all duration-500 ${scrolled ? 'bg-background/95 backdrop-blur-md border-b border-border' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-full border-2 border-foreground flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-accent" />
            </div>
            <div className="leading-none">
              <div className="font-heading text-xl tracking-widest text-foreground">AVALON</div>
              <div className="text-[9px] tracking-[0.3em] text-muted-foreground font-body -mt-0.5">VITALITY</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-8">
            <Link to="/" className="text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors font-body uppercase">Home</Link>

            {/* Services Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setServicesOpen(!servicesOpen)}
                className="flex items-center gap-1 text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors font-body uppercase"
              >
                Services <ChevronDown className={`w-3 h-3 transition-transform ${servicesOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {servicesOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-card border border-border rounded-lg overflow-hidden shadow-2xl"
                  >
                    <div className="p-2">
                      <p className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase px-3 py-2 font-body">Available Now</p>
                      {activeServices.map((s) => (
                        <Link
                          key={s.href}
                          to={s.href}
                          className="block px-3 py-2.5 text-xs tracking-wider text-foreground hover:bg-secondary hover:text-accent transition-colors rounded font-body uppercase"
                        >
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
                          <span key={s} className="px-3 py-2 text-[10px] tracking-wide text-muted-foreground/50 font-body uppercase cursor-not-allowed">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link to="/our-story" className="text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors font-body uppercase">Our Story</Link>
            <a href="/#faq" className="text-xs tracking-widest text-muted-foreground hover:text-foreground transition-colors font-body uppercase">FAQ</a>
          </div>

          {/* CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href={BOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-foreground text-background text-xs tracking-widest font-body uppercase font-semibold hover:bg-foreground/90 transition-colors rounded"
            >
              Start Your Recovery
            </a>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden text-foreground p-2">
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
                <Link to="/" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">Home</Link>

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
                        <p className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase font-body">Available Now</p>
                        {activeServices.map((s) => (
                          <Link key={s.href} to={s.href} className="block text-sm tracking-wider text-foreground hover:text-accent font-body uppercase">
                            {s.label}
                          </Link>
                        ))}
                        <p className="text-[9px] tracking-[0.25em] text-muted-foreground uppercase font-body pt-2 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> Coming Soon
                        </p>
                        {comingSoon.map((s) => (
                          <span key={s} className="block text-xs tracking-wider text-muted-foreground/40 font-body uppercase">{s}</span>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Link to="/our-story" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">Our Story</Link>
                <a href="/#faq" className="block text-sm tracking-widest text-muted-foreground hover:text-foreground font-body uppercase">FAQ</a>

                <a
                  href={BOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-5 py-3 bg-foreground text-background text-sm tracking-widest font-body uppercase font-semibold mt-4 rounded"
                >
                  Start Your Recovery
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}