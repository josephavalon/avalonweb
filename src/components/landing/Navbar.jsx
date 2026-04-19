import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Droplets } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'MEMBERSHIP', href: '#membership' },
    { label: 'ABOUT', href: '/about' },
    { label: 'FAQS', href: '#faq' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-background/90 backdrop-blur-md' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-20">
        <Link to="/" className="flex items-center gap-3">
          <Droplets className="w-6 h-6 text-primary" />
          <span className="font-heading text-xl tracking-widest text-foreground">THE INFUSION</span>
        </Link>

        <div className="hidden md:flex items-center gap-10">
          {navLinks.map((link) => (
            link.href.startsWith('#') ? (
              <a key={link.label} href={link.href} className="text-xs tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors font-body">
                {link.label}
              </a>
            ) : (
              <Link key={link.label} to={link.href} className="text-xs tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors font-body">
                {link.label}
              </Link>
            )
          ))}
        </div>

        <a href="#membership" className="hidden md:block text-xs tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors font-body">
          BOOK NOW
        </a>

        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden text-foreground">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-background/95 backdrop-blur-lg border-t border-border"
          >
            <div className="px-6 py-8 flex flex-col gap-6">
              {navLinks.map((link) => (
                link.href.startsWith('#') ? (
                  <a key={link.label} href={link.href} onClick={() => setMobileOpen(false)} className="text-sm tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors font-body">
                    {link.label}
                  </a>
                ) : (
                  <Link key={link.label} to={link.href} onClick={() => setMobileOpen(false)} className="text-sm tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors font-body">
                    {link.label}
                  </Link>
                )
              ))}
              <a href="#membership" onClick={() => setMobileOpen(false)} className="text-sm tracking-[0.2em] text-primary font-body">
                BOOK NOW
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}