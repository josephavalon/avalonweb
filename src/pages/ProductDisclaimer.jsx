import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

export default function ProductDisclaimer() {
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
            PRODUCT DISCLAIMER
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
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Medical Disclaimer</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              The information provided on this website and through our services is for educational purposes only and should not be considered medical advice. IV therapy and nutritional supplements are not intended to diagnose, treat, cure, or prevent any disease.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Professional Consultation</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              Before receiving any IV therapy or nutritional treatment, you should consult with a qualified healthcare provider to determine if it is appropriate for your individual health situation. Our medical team will conduct a comprehensive assessment, but ultimate responsibility for your health decisions rests with you.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Ingredient Information</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              All ingredients used in our IV formulations are pharmaceutical-grade and meet FDA standards. However, individual reactions to ingredients may vary. Please disclose all allergies, sensitivities, and current medications during your consultation.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Results Vary</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              Individual results from IV therapy vary based on personal health status, lifestyle factors, and overall wellness practices. We cannot guarantee specific outcomes, and testimonials on our website represent individual experiences and should not be construed as guaranteed results.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Contraindications</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              Certain medical conditions may contraindicate IV therapy. These include but are not limited to: kidney disease, heart failure, severe allergies, and certain autoimmune conditions. Our medical team will screen for contraindications during your assessment.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Contact Us</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              If you have questions about our products or this disclaimer, please contact us at support@avalonvitality.co.
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}