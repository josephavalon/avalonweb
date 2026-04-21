import React from 'react';
import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Droplet } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

const productData = {
  'dehydration': {
    name: 'Dehydration IV',
    category: 'IV Vitamins',
    price: 150,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Dehydration-1000ml.jpg',
    tagline: 'Pure hydration for balance and renewal.',
    includes: ['1000mL Lactated Ringers'],
    description: 'The Dehydration IV is designed for rapid rehydration and electrolyte restoration. Perfect for anyone needing balance and wellness renewal.',
    supports: ['Hydration', 'Balance', 'Wellness'],
    benefits: [
      'Immediate rehydration',
      'Electrolyte restoration',
      'Enhanced circulation',
      'Improved wellness',
    ],
  },
  'myers-cocktail': {
    name: "Myers' Cocktail IV",
    category: 'IV Vitamins',
    price: 250,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Myers-Cocktail-1000ml.jpg',
    tagline: 'Premium vitamin blend for energy and immunity.',
    includes: ['B-complex vitamins', 'Vitamin C', 'Magnesium', 'Zinc', 'Calcium'],
    description: "The Myers' Cocktail is a comprehensive IV formula containing essential vitamins and minerals. It's designed to support energy levels, immunity, and overall wellness.",
    supports: ['Energy', 'Immunity', 'Wellness'],
    benefits: [
      'Boosted energy levels',
      'Enhanced immunity',
      'Improved mood',
      'Better nutrient absorption',
    ],
  },
  'energy': {
    name: 'Energy IV',
    category: 'IV Vitamins',
    price: 250,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Energy-1000ml.jpg',
    tagline: 'Boost energy levels and mental clarity.',
    includes: ['B-vitamins', 'Amino acids', 'Vitamins', 'Minerals'],
    description: 'The Energy IV is formulated to provide immediate and sustained energy boost. Ideal for busy professionals, athletes, and anyone needing a performance edge.',
    supports: ['Energy', 'Focus', 'Performance'],
    benefits: [
      'Rapid energy boost',
      'Enhanced mental clarity',
      'Improved focus',
      'Better performance',
    ],
  },
  'hangover': {
    name: 'Hangover IV',
    category: 'IV Vitamins',
    price: 250,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Hangover-1000ml.jpg',
    tagline: 'Fast recovery from hangovers.',
    includes: ['Hydration solution', 'B-vitamins', 'Electrolytes', 'Anti-inflammatory agents'],
    description: 'The Hangover IV is specifically designed for rapid hangover recovery. It rehydrates and restores electrolytes while reducing symptoms.',
    supports: ['Recovery', 'Hydration', 'Wellness'],
    benefits: [
      'Rapid symptom relief',
      'Full rehydration',
      'Electrolyte restoration',
      'Improved wellbeing',
    ],
  },
  'immunity': {
    name: 'Immunity IV',
    category: 'IV Vitamins',
    price: 250,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Immunity-1000ml.jpg',
    tagline: 'Support your immune system.',
    includes: ['Vitamin C', 'Zinc', 'Selenium', 'B-vitamins'],
    description: 'The Immunity IV boosts your immune system with high-dose vitamin C and essential minerals. Support your body during cold and flu season.',
    supports: ['Immunity', 'Wellness', 'Support'],
    benefits: [
      'Enhanced immune response',
      'Faster recovery',
      'Increased antioxidants',
      'Better health',
    ],
  },
  'beauty': {
    name: 'Beauty IV',
    category: 'IV Vitamins',
    price: 250,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Beauty-1000ml.jpg',
    tagline: 'Enhance skin health and beauty.',
    includes: ['Biotin', 'Glutathione', 'Vitamin C', 'Collagen support'],
    description: 'The Beauty IV is formulated with nutrients that support skin health, hair, and nail growth. Beauty from within.',
    supports: ['Beauty', 'Skin Health', 'Wellness'],
    benefits: [
      'Enhanced skin radiance',
      'Improved hair health',
      'Stronger nails',
      'Natural glow',
    ],
  },
  'event-recovery': {
    name: 'Event Recovery IV',
    category: 'IV Vitamins',
    price: 250,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Event-Recovery-1000ml.jpg',
    tagline: 'Recover fast after events.',
    includes: ['Anti-inflammatory agents', 'Amino acids', 'Electrolytes', 'Hydration'],
    description: 'The Event Recovery IV is perfect for post-event recovery. Whether after a festival, workout, or long event, recover fast.',
    supports: ['Recovery', 'Performance', 'Hydration'],
    benefits: [
      'Rapid recovery',
      'Reduced inflammation',
      'Electrolyte restoration',
      'Quick rejuvenation',
    ],
  },
  'event-performance': {
    name: 'Event Performance IV',
    category: 'IV Vitamins',
    price: 250,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Event-Performance-1000ml.jpg',
    tagline: 'Optimize performance before events.',
    includes: ['Energy-boosting compounds', 'B-vitamins', 'Amino acids', 'Minerals'],
    description: 'The Event Performance IV is designed to maximize your performance. Get the edge you need before competition or important events.',
    supports: ['Performance', 'Energy', 'Endurance'],
    benefits: [
      'Enhanced endurance',
      'Improved performance',
      'Better energy',
      'Competitive advantage',
    ],
  },
  'migraine': {
    name: 'Migraine IV',
    category: 'IV Vitamins',
    price: 250,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Migraine-1000ml-1.jpg',
    tagline: 'Relief from migraines.',
    includes: ['Magnesium', 'Pain relief compounds', 'Hydration', 'Anti-inflammatory agents'],
    description: 'The Migraine IV provides rapid relief from migraine symptoms through targeted pain management and hydration.',
    supports: ['Relief', 'Recovery', 'Wellness'],
    benefits: [
      'Rapid pain relief',
      'Reduced severity',
      'Symptom management',
      'Improved comfort',
    ],
  },
  'jet-lag': {
    name: 'Jet Lag IV',
    category: 'IV Vitamins',
    price: 250,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Jet-Lag-1000ml.jpg',
    tagline: 'Combat jet lag with hydration and vitamins.',
    includes: ['Sleep-support vitamins', 'Hydration solution', 'Electrolytes', 'B-vitamins'],
    description: 'The Jet Lag IV is specifically designed for travelers. Combat the effects of travel with targeted hydration and vitamins.',
    supports: ['Recovery', 'Travel Support', 'Wellness'],
    benefits: [
      'Faster adaptation',
      'Better sleep',
      'Reduced fatigue',
      'Quick recovery',
    ],
  },
  'food-poisoning': {
    name: 'Food Poisoning IV',
    category: 'IV Vitamins',
    price: 250,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Food-Poisoning-1000ml.jpg',
    tagline: 'Fast relief from food poisoning.',
    includes: ['Anti-nausea compounds', 'Electrolytes', 'Hydration', 'Recovery nutrients'],
    description: 'The Food Poisoning IV provides rapid relief and recovery from food poisoning symptoms with targeted hydration and nutrients.',
    supports: ['Recovery', 'Hydration', 'Relief'],
    benefits: [
      'Rapid symptom relief',
      'Full rehydration',
      'Electrolyte restoration',
      'Quick recovery',
    ],
  },
  'flu-relief': {
    name: 'Flu Relief IV',
    category: 'IV Vitamins',
    price: 250,
    duration: '30–60 min',
    image: 'https://avalonvitality.co/wp-content/uploads/2025/07/Flu-Relief-1000ml.jpg',
    tagline: 'Support recovery from flu symptoms.',
    includes: ['High-dose Vitamin C', 'Zinc', 'B-vitamins', 'Antioxidants'],
    description: 'The Flu Relief IV supports immune recovery with high-dose vitamins and minerals to help you bounce back faster.',
    supports: ['Immunity', 'Relief', 'Recovery'],
    benefits: [
      'Enhanced immunity',
      'Faster recovery',
      'Symptom relief',
      'Better wellness',
    ],
  },
};

export default function ProductDetail() {
  const { slug } = useParams();
  const product = productData[slug];

  if (!product) {
    return (
      <div className="bg-background min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-foreground">Product not found</p>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="pt-20 pb-12 px-4 border-b border-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6"
          >
            <Link to="/products/iv-vitamins" className="flex items-center gap-2 text-accent hover:text-accent/80 text-sm font-body uppercase tracking-wide mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to IV Vitamins
            </Link>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="aspect-square rounded-3xl overflow-hidden border border-border">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-[10px] tracking-[0.3em] text-accent font-body uppercase mb-3">{product.category}</p>
              <h1 className="font-heading text-5xl md:text-6xl text-foreground tracking-wide mb-3">{product.name}</h1>
              <p className="font-body text-base text-muted-foreground mb-8">{product.tagline}</p>

              <div className="flex items-baseline gap-3 mb-8">
                <span className="font-heading text-5xl text-foreground">${product.price}</span>
                <span className="font-body text-sm text-muted-foreground">one-time</span>
              </div>

              <div className="flex items-center gap-4 mb-8 pb-8 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent" />
                  <span className="font-body text-sm text-muted-foreground">{product.duration}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-accent" />
                  <span className="font-body text-sm text-muted-foreground">Direct IV</span>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="font-heading text-xl text-foreground tracking-wide mb-3">Includes</h3>
                <ul className="space-y-2">
                  {product.includes.map((item) => (
                    <li key={item} className="flex items-center gap-2 font-body text-sm text-muted-foreground">
                      <div className="w-1 h-1 rounded-full bg-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href="https://avalonvitality.as.me/schedule/a9d85b1e"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full text-center px-8 py-4 bg-foreground text-background font-body text-xs tracking-widest uppercase font-semibold hover:bg-foreground/90 transition-colors rounded-full"
              >
                Book Now
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Description & Benefits */}
      <section className="py-16 px-4 border-b border-border">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-heading text-3xl text-foreground tracking-wide mb-4">About This Treatment</h2>
            <p className="font-body text-muted-foreground leading-relaxed">{product.description}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="font-heading text-3xl text-foreground tracking-wide mb-4">Benefits</h2>
            <ul className="space-y-3">
              {product.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                  <span className="font-body text-muted-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="py-12 px-4 bg-secondary/30">
        <div className="max-w-6xl mx-auto">
          <p className="font-body text-xs text-muted-foreground/60 text-center">
            For general wellness only. Not intended to diagnose, treat, cure, or prevent any condition. 
            Performed by California-licensed nurses under physician supervision.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}