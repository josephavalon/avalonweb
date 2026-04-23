import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

export default function TelehealthDisclaimer() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />
      
      <section className="py-12 md:py-16 px-6 md:px-16 border-b border-border">
        <div className="max-w-3xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="font-heading text-6xl md:text-7xl text-foreground tracking-wide mb-3"
          >
            TELEHEALTH DISCLAIMER
          </motion.h1>
          <p className="font-body text-sm text-muted-foreground">Last updated: April 2026</p>
        </div>
      </section>

      <section className="py-12 px-6 md:px-16">
        <div className="max-w-3xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Important Notice</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              Avalon Vitality provides in-home IV therapy services administered by licensed nurses under physician supervision. While we offer telehealth consultations for initial assessments and follow-ups, the administration of intravenous therapy requires in-person evaluation and treatment.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Medical Disclaimer</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              IV therapy is not appropriate for everyone. Certain medical conditions, medications, or allergies may prevent you from receiving intravenous treatments. Our medical team will conduct a thorough health assessment before proceeding with any treatment.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Assumption of Risk</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              While IV therapy is generally safe when administered by qualified healthcare professionals, all medical procedures carry inherent risks, including but not limited to infection, bruising, vein irritation, and allergic reactions. You acknowledge and assume all risks associated with receiving IV therapy.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Physician Supervision</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              All IV protocols are designed and supervised by licensed physicians. However, the physician may not be physically present during the administration of your treatment. You will have the opportunity to discuss your health history and treatment plan with our clinical team prior to receiving any infusions.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Contact Us</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              If you have questions about this disclaimer or our telehealth services, please contact us at support@avalonvitality.co.
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}