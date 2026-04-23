import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

export default function TermsAndConditions() {
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
            TERMS AND CONDITIONS
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
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Agreement to Terms</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              By accessing and using this website and our services, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Use License</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              Permission is granted to temporarily download one copy of the materials (information or software) on Avalon Vitality's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside space-y-2 font-body text-muted-foreground leading-relaxed">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose or for any public display</li>
              <li>Attempt to decompile or reverse engineer any software contained on the website</li>
              <li>Remove any copyright or other proprietary notations from the materials</li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Disclaimer</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              The materials on Avalon Vitality's website are provided on an 'as is' basis. Avalon Vitality makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Limitations</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              In no event shall Avalon Vitality or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Avalon Vitality's website.
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
              If you have any questions about these Terms and Conditions, please contact us at support@avalonvitality.co.
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}