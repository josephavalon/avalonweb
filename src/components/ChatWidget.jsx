import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-20 right-0 w-80 bg-white rounded-2xl shadow-xl p-6 mb-2"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                  <span className="text-[10px] text-background font-semibold">AV</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-heading text-lg text-foreground">Hi there, have a question about our services?</h3>
                <p className="font-body text-sm text-muted-foreground mt-2">Message us here we will answer now.</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="w-16 h-16 rounded-full bg-white hover:bg-white/90 flex items-center justify-center text-foreground shadow-lg transition-colors"
      >
        <MessageCircle className="w-7 h-7" />
      </motion.button>
    </div>
  );
}