import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';

export default function PrivacyPolicy() {
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
            PRIVACY POLICY
          </motion.h1>
          <p className="font-body text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
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
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Introduction</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              Avalon Vitality ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Information We Collect</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              We collect information you voluntarily provide when booking appointments, including your name, email, phone number, and health information necessary to provide our services.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">How We Use Your Information</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              Your information is used to provide and improve our services, process transactions, send promotional communications, and comply with legal obligations.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="space-y-4"
          >
            <h2 className="font-heading text-2xl text-foreground tracking-wide">Data Security</h2>
            <p className="font-body text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
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
              If you have questions about this Privacy Policy, please contact us at support@avalonvitality.co.
            </p>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}