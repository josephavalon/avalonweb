import React from 'react';
import { motion, useReducedMotion } from '@/components/ui/PageTransitionMotion';
import { EASE, premiumHover, premiumTap } from '@/lib/motion';

export default function PremiumButton({ as: Component = 'button', className = '', wrapperClassName = '', children, ...props }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : premiumHover}
      whileTap={reduceMotion ? undefined : premiumTap}
      transition={{ duration: 0.36, ease: EASE }}
      className={`inline-flex ${wrapperClassName}`}
    >
      <Component className={`av-premium-cta ${className}`} {...props}>
        {children}
      </Component>
    </motion.div>
  );
}
