import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import ClinicalOversight from '../components/landing/ClinicalOversight';

const EASE = [0.16, 1, 0.3, 1];

// Standalone page for clinical gravitas. Named Medical Director + Protocol
// methodology. FDA-safe throughout — frames oversight and methodology, not
// therapeutic outcomes. Linked from Footer → Company rail.
export default function MedicalDirection() {
  return (
    <div className="bg-background min-h-screen">
      <Navbar />

      <div className="pt-24 md:pt-32">
        <ClinicalOversight />
      </div>

      <Footer />
    </div>
  );
}
