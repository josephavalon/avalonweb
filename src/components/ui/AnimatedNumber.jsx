import React, { useEffect, useRef } from 'react';
import { useMotionValue, useTransform, animate } from 'framer-motion';

/**
 * Counts from previous value to `value` on change using editorial easing.
 * Use `prefix` / `suffix` for $ or % or labels.
 * `duration` defaults to 0.8s — tuned for price reveals.
 */
export default function AnimatedNumber({ value, prefix = '', suffix = '', duration = 0.8, format }) {
  const motionVal = useMotionValue(0);
  const rendered = useTransform(motionVal, (v) => {
    const n = Math.round(v);
    return prefix + (format ? format(n) : n.toLocaleString()) + suffix;
  });
  const node = useRef(null);

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration,
      ease: [0.16, 1, 0.3, 1]
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    return rendered.on('change', (latest) => {
      if (node.current) node.current.textContent = latest;
    });
  }, [rendered]);

  return <span ref={node}>{prefix + (format ? format(0) : '0') + suffix}</span>;
}
