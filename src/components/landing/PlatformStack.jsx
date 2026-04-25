import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Database, Layers, Truck } from 'lucide-react';

// Concept C — The Avalon OS. Sells Avalon as infrastructure (vs. competitors who sell service).
// Stacked layers, top-down: Intelligence → Data → Modalities → Delivery.
// Reads as a tech-stack diagram for VCs and as a credibility marker for members.
const LAYERS = [
  {
    n: 4,
    name: 'Intelligence',
    desc: 'AI protocol recommendations · outcome models · personalized re-protocol cadence',
    icon: Brain,
  },
  {
    n: 3,
    name: 'Data',
    desc: 'Longitudinal biomarker timeline · wearable feeds · genomics layer (2027)',
    icon: Database,
  },
  {
    n: 2,
    name: 'Modalities',
    desc: 'IV · NAD+ · CBD · Peptides · TRT · Aesthetics · Ketamine · Exosomes',
    icon: Layers,
  },
  {
    n: 1,
    name: 'Delivery',
    desc: 'Concierge nurse network · compounding pharmacy partners · in-home & in-studio',
    icon: Truck,
  },
];

export default function PlatformStack() {
  return (
    <section id="operating-system" className="py-8 md:py-6 px-4 border-t border-border">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.85, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="text-left mb-6 md:mb-10"
        >
          <p className="text-xs tracking-[0.35em] text-accent font-body uppercase mb-4">The Operating System</p>
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95] md:whitespace-nowrap">FROM DELIVERY TO INTELLIGENCE</h2>
          <p className="font-body text-sm md:text-base text-foreground/85 mt-4 max-w-2xl">
            What competitors call a service, we call infrastructure. Every IV is a delivery, a data point,
            and a step in your protocol's evolution. Four layers, one record.
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
                <div className="font-body text-[10px] md:text-xs tracking-[0.3em] text-accent uppercase pt-1">
                  Layer {layer.n}
                </div>
                <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-full border border-foreground/20 text-foreground">
                  <Icon className="w-4 h-4" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-heading text-2xl md:text-4xl text-foreground tracking-wide uppercase leading-tight mb-1">
                    {layer.name}
                  </h3>
                  <p className="font-body text-xs md:text-sm text-muted-foreground leading-relaxed">
                    {layer.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="font-body text-xs md:text-sm tracking-wide text-muted-foreground/80 text-center mt-8 md:mt-10 max-w-3xl mx-auto leading-relaxed"
        >
          IV is where we start. The data is what compounds.
        </motion.p>
      </div>
    </section>
  );
}
