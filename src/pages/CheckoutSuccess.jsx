import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';

const EASE = [0.16, 1, 0.3, 1];

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const type = params.get('type'); // 'onetime' | 'membership'

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-md mx-auto px-4 pt-32 pb-20 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="w-16 h-16 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-8"
        >
          <Check className="w-7 h-7 text-accent" strokeWidth={2.5} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
        >
          <p className="font-body text-[11px] tracking-[0.35em] uppercase text-accent mb-4">
            {type === 'membership' ? 'Membership Confirmed' : 'Request Received'}
          </p>
          <h1 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide uppercase leading-[0.95] mb-6">
            {type === 'membership' ? "You're In." : "We'll Be In Touch."}
          </h1>
          <p className="font-body text-sm text-foreground/60 leading-relaxed max-w-sm mx-auto mb-10">
            {type === 'membership'
              ? 'Your membership is active. A member concierge will reach out within 24 hours to book your first session.'
              : 'Your card has been authorized. A licensed RN will confirm your appointment details and arrival window shortly.'
            }
          </p>

          <div className="space-y-3">
            <Link
              to="/"
              className="flex items-center justify-center gap-2 w-full py-3.5 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl border border-foreground/20 text-foreground hover:border-foreground transition-colors"
            >
              Back to Avalon <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </Link>
            {type === 'membership' && (
              <Link
                to="/members"
                className="flex items-center justify-center gap-2 w-full py-3.5 font-body text-sm tracking-widest uppercase font-semibold rounded-2xl bg-accent text-background hover:bg-accent/90 transition-colors"
              >
                My Avalon <ArrowRight className="w-4 h-4" strokeWidth={2} />
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
