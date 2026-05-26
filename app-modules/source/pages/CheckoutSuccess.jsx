import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSeo } from '@/lib/seo';
import { motion } from '@/components/ui/PageTransitionMotion';
import { Check, ArrowRight } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';

const EASE = [0.16, 1, 0.3, 1];

export default function CheckoutSuccess() {
  useSeo({
    title: 'Booking Confirmed — Avalon Vitality',
    description: 'Your Avalon Vitality session is confirmed. A licensed RN will be in touch shortly with arrival details.',
    path: '/checkout/success',
  });
  const [params] = useSearchParams();
  const type = params.get('type'); // 'onetime' | 'subscription'
  const sessionId = params.get('session_id');
  const preApi = params.get('preapi') === '1';
  const [verification, setVerification] = useState(() => preApi ? 'local' : sessionId ? 'checking' : 'missing');

  useEffect(() => {
    if (preApi || !sessionId) return;
    let cancelled = false;
    fetch('/api/checkout/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.paid) throw new Error(data?.error || 'Payment not verified');
        if (!cancelled) setVerification('paid');
      })
      .catch(() => {
        if (!cancelled) setVerification('failed');
      });
    return () => { cancelled = true; };
  }, [preApi, sessionId]);

  const verified = verification === 'paid' || verification === 'local';
  const isChecking = verification === 'checking';
  const isSubscription = type === 'subscription' || type === 'membership';

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
            {isChecking ? 'Verifying' : verified ? (isSubscription ? 'Subscription Confirmed' : 'Request Received') : 'Not Verified'}
          </p>
          <h1 className="font-heading text-5xl md:text-7xl text-foreground tracking-wide uppercase leading-[0.95] mb-6">
            {isChecking ? 'Hold Tight.' : verified ? (isSubscription ? "You're In." : "We'll Be In Touch.") : 'Payment Check Needed.'}
          </h1>
          <p className="font-body text-sm text-foreground/60 leading-relaxed max-w-sm mx-auto mb-10">
            {isChecking
              ? 'We are verifying the checkout session before confirming this request.'
              : !verified
                ? 'This page needs a verified checkout session before it can show confirmation. Return to checkout or contact support if you already paid.'
                : isSubscription
              ? 'Your subscription is active. Your care team will reach out within 24 hours to book your first session.'
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
            {verified && isSubscription && (
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
