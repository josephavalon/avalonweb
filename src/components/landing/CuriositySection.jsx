import React from 'react';
import { motion } from 'framer-motion';

export default function CuriositySection() {
  return (
    <section className="py-16 md:py-20 px-6 md:px-16">
      <div className="max-w-2xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="font-heading text-[9vw] md:text-8xl text-foreground tracking-wide leading-[0.95]">
            CURIOUS BUT NOT QUITE READY TO DIVE IN?
          </h2>
          
          <p className="font-body text-lg text-muted-foreground mb-8 leading-relaxed">
            We'd love to connect.
          </p>
          
          <p className="font-body text-base text-muted-foreground mb-10 leading-relaxed max-w-lg mx-auto">
            Email our team to explore how Avalon Vitality works — and whether it's the right fit for you.
          </p>
          
          <a
            href="mailto:support@avalonvitality.co"
            className="inline-block px-10 py-4 bg-foreground text-background font-body text-sm tracking-widest uppercase font-semibold rounded-full hover:bg-foreground/90 transition-colors"
          >
            Contact Us
          </a>
        </motion.div>
      </div>
    </section>
  );
}