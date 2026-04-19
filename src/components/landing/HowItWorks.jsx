import React from 'react';
import { motion } from 'framer-motion';

const steps = [
  { num: '1º', title: 'Book your session', desc: 'Choose your drip and select a time and location that works for you.' },
  { num: '2º', title: 'Health intake', desc: 'Complete a brief medical questionnaire reviewed by a licensed provider.' },
  { num: '3º', title: 'Physician approval', desc: 'A physician reviews your health profile and approves your treatment plan.' },
  { num: '4º', title: 'Nurse arrives', desc: 'A registered nurse comes to you — home, office, or hotel — fully equipped.' },
  { num: '5º', title: 'Relax & recharge', desc: 'Sit back for 30-60 minutes while your body absorbs clinical-grade nutrients.' },
];

export default function HowItWorks() {
  return (
    <section className="py-24 md:py-32 px-6 bg-secondary/30">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl text-foreground">
            How do I get started?
          </h2>
        </motion.div>

        <div className="space-y-10">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex gap-6 items-start"
            >
              <span className="font-heading text-2xl md:text-3xl text-primary shrink-0 w-12">
                {step.num}
              </span>
              <div>
                <h3 className="font-heading text-lg md:text-xl text-foreground mb-1">{step.title}</h3>
                <p className="font-body text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-center mt-16"
        >
          <a
            href="#membership"
            className="inline-block text-xs tracking-[0.2em] text-foreground underline underline-offset-4 decoration-primary font-body hover:text-primary transition-colors"
          >
            See Membership Plan
          </a>
        </motion.div>
      </div>
    </section>
  );
}