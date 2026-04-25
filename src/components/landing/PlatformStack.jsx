import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Database, Layers, Truck, Smartphone } from 'lucide-react';

const LAYERS = [
  { n: 4, name: 'Intelligence', desc: 'Predicts when and what will move your health forward — across IV, peptides, TRT, aesthetics. Outcome-tuned to your data.', icon: Brain },
  { n: 3, name: 'Data', desc: 'Longitudinal biomarker timeline · wearable feeds · genomics layer (2027)', icon: Database },
  { n: 2, name: 'Modalities', desc: 'IV · NAD+ · CBD · Peptides · TRT · Aesthetics · Ketamine · Exosomes', icon: Layers },
  { n: 1, name: 'Delivery', desc: 'Concierge nurse network · compounding pharmacy partners · in-home & in-studio', icon: Truck },
];

export default function PlatformStack() {
  return (
    <section id="operating-system" className="py-8 md:py-6 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-left mb-6 md:mb-10"
        >
          <p className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-4">The Operating System</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95] md:whitespace-nowrap">FROM DELIVERY TO INTELLIGENCE</h2>
          <p className="font-body text-sm md:text-base text-foreground/85 mt-4 max-w-2xl">
            Every delivery is a data point, and a step in your protocol's evolution. Four layers, one record.
          </p>
        </motion.div>

        <div className="flex flex-col">
          {LAYERS.map((layer, i) => {
            const Icon = layer.icon;
            return (
              <motion.div
                key={layer.n}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10%' }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="group relative grid grid-cols-[auto_1fr] md:grid-cols-[120px_auto_1fr] items-start gap-4 md:gap-6 py-5 md:py-6 border-t border-border/60 last:border-b last:border-border/60"
              >
                <div className="font-body text-[10px] md:text-xs tracking-[0.3em] text-accent uppercase pt-1">Layer {layer.n}</div>
                <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-full border border-foreground/20 text-foreground">
                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-heading text-2xl md:text-4xl text-foreground tracking-wide uppercase leading-tight mb-1">{layer.name}</h3>
                  <p className="font-body text-xs md:text-sm text-muted-foreground leading-relaxed">{layer.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Avalon OS mobile app badge */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 md:mt-14 mx-auto max-w-3xl border border-foreground/20 rounded-xl px-6 md:px-10 py-6 md:py-8 flex items-center gap-5 md:gap-7"
        >
          <div className="shrink-0 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full border border-accent/40 text-accent">
            <Smartphone className="w-5 h-5 md:w-6 md:h-6" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent font-body uppercase mb-1">Avalon OS · Mobile</p>
            <h3 className="font-heading text-xl md:text-3xl text-foreground tracking-wide uppercase leading-tight">Coming Soon to iOS & Android</h3>
            <p className="font-body text-xs md:text-sm text-muted-foreground mt-1.5">Your protocol, your data, your record — in your pocket.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
