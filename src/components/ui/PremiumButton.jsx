import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '@/lib/motion';

export default function PremiumButton({ as: Component = 'button', className = '', wrapperClassName = '', children, ...props }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.006 }}
      whileTap={reduceMotion ? undefined : { scale: 0.975 }}
      transition={{ duration: 0.36, ease: EASE }}
      className={`inline-flex ${wrapperClassName}`}
    >
      <Component className={`av-premium-cta ${className}`} {...props}>
        {children}
      </Component>
    </motion.div>
  );
}
