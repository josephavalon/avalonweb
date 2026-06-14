export const premiumEase = [0.16, 1, 0.3, 1];

export const pageMotion = {
  initial: { opacity: 0, y: 14, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(6px)' },
  transition: { duration: 0.42, ease: premiumEase },
};

export const accordionMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.32, ease: premiumEase },
};

export const pressMotion = {
  whileTap: { scale: 0.985 },
  transition: { duration: 0.18, ease: premiumEase },
};

