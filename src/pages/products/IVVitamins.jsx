import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

const vitamins = [
  {
    name: 'Dehydration IV',
    price: 150,
    desc: 'Pure hydration for balance and renewal. Includes 1000mL Lactated Ringers.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Dehydration-1000ml.jpg',
    href: '/products/iv-vitamins/dehydration',
    supports: 'Hydration · Balance · Wellness'
  },
  {
    name: "Myers' Cocktail IV",
    price: 250,
    desc: 'Premium vitamin blend for energy and immunity support.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Myers-Cocktail-1000ml.jpg',
    href: '/products/iv-vitamins/myers-cocktail',
    supports: 'Energy · Immunity · Wellness'
  },
  {
    name: 'Energy IV',
    price: 250,
    desc: 'Boost energy levels and mental clarity with our energy-focused formula.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Energy-1000ml.jpg',
    href: '/products/iv-vitamins/energy',
    supports: 'Energy · Focus · Performance'
  },
  {
    name: 'Hangover IV',
    price: 250,
    desc: 'Fast recovery from hangovers with rehydration and electrolyte restoration.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Hangover-1000ml.jpg',
    href: '/products/iv-vitamins/hangover',
    supports: 'Recovery · Hydration · Wellness'
  },
  {
    name: 'Immunity IV',
    price: 250,
    desc: 'Support your immune system with targeted nutrients and vitamins.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Immunity-1000ml.jpg',
    href: '/products/iv-vitamins/immunity',
    supports: 'Immunity · Wellness · Support'
  },
  {
    name: 'Beauty IV',
    price: 250,
    desc: 'Enhance skin health and beauty from within with specialized nutrients.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Beauty-1000ml.jpg',
    href: '/products/iv-vitamins/beauty',
    supports: 'Beauty · Skin Health · Wellness'
  },
  {
    name: 'Event Recovery IV',
    price: 250,
    desc: 'Recover fast after events with anti-inflammatory and hydration support.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Event-Recovery-1000ml.jpg',
    href: '/products/iv-vitamins/event-recovery',
    supports: 'Recovery · Performance · Hydration'
  },
  {
    name: 'Event Performance IV',
    price: 250,
    desc: 'Optimize performance before events with energy and endurance support.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Event-Performance-1000ml.jpg',
    href: '/products/iv-vitamins/event-performance',
    supports: 'Performance · Energy · Endurance'
  },
  {
    name: 'Migraine IV',
    price: 250,
    desc: 'Relief from migraines with targeted pain management and hydration.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Migraine-1000ml-1.jpg',
    href: '/products/iv-vitamins/migraine',
    supports: 'Relief · Recovery · Wellness'
  },
  {
    name: 'Jet Lag IV',
    price: 250,
    desc: 'Combat jet lag with hydration and vitamins designed for travelers.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Jet-Lag-1000ml.jpg',
    href: '/products/iv-vitamins/jet-lag',
    supports: 'Recovery · Travel Support · Wellness'
  },
  {
    name: 'Food Poisoning IV',
    price: 250,
    desc: 'Fast relief from food poisoning with hydration and electrolyte restoration.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Food-Poisoning-1000ml.jpg',
    href: '/products/iv-vitamins/food-poisoning',
    supports: 'Recovery · Hydration · Relief'
  },
  {
    name: 'Flu Relief IV',
    price: 250,
    desc: 'Support recovery from flu symptoms with immune-boosting nutrients.',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Flu-Relief-1000ml.jpg',
    href: '/products/iv-vitamins/flu-relief',
    supports: 'Immunity · Relief · Recovery'
  },
];

export default function IVVitaminsCategory() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      
      {/* Hero */}
      <section className="pt-24 pb-16 px-4 border-b border-border">
        <div className="max-w-6xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-4">Wellness Foundation</p>
            <h1 className="font-heading text-6xl md:text-8xl text-foreground tracking-wide mb-6">IV VITAMINS</h1>
            <p className="font-body text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Dehydration, Myers' Cocktail, Hangover, Energy, Immunity, Beauty & more. Direct nutrient delivery for immediate wellness.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vitamins.map((vitamin, i) => (
              <motion.div
                key={vitamin.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  to={vitamin.href}
                  className="group block h-full border border-border rounded-3xl overflow-hidden bg-card hover:border-accent/40 transition-all duration-500"
                >
                  <div className="aspect-square relative overflow-hidden">
                    <img
                      src={vitamin.image}
                      alt={vitamin.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                  </div>
                  <div className="p-6">
                    <p className="text-[10px] tracking-[0.2em] text-accent font-body uppercase mb-2">${vitamin.price}</p>
                    <h3 className="font-heading text-2xl text-foreground tracking-wide mb-2">{vitamin.name}</h3>
                    <p className="font-body text-xs text-muted-foreground mb-3 leading-relaxed">{vitamin.desc}</p>
                    <p className="font-body text-[9px] text-muted-foreground/60 tracking-widest uppercase">{vitamin.supports}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}