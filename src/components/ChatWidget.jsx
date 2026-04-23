import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

// Tapping this opens the user's native SMS app addressed to Avalon's line.
// iOS (Messages), macOS (Messages), Android (default SMS) all honor sms: URIs.
const AVALON_SMS_HREF = 'sms:+14159807708?&body=Hi%20Avalon%2C%20';

export default function ChatWidget() {
  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      <motion.a
        href={AVALON_SMS_HREF}
        aria-label="Text Avalon Vitality at (415) 980-7708"
        title="Text us"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="w-16 h-16 rounded-full bg-white hover:bg-white/90 flex items-center justify-center text-background shadow-lg transition-colors"
      >
        <MessageCircle className="w-7 h-7" />
      </motion.a>
    </div>
  );
}
