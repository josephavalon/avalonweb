import { useEffect } from 'react';

const MIN_BOOT_MS = 1120;
const EXIT_MS = 620;

export default function AppLoader() {
  useEffect(() => {
    const splash = document.getElementById('av-boot-splash');
    if (!splash) return undefined;

    const bootStarted = Number(window.__AV_BOOT_STARTED_AT || 0) || performance.timeOrigin || Date.now();
    const elapsed = Date.now() - bootStarted;
    let exitTimer;
    let removeTimer;
    let frameOne;
    let frameTwo;

    const releaseSplash = () => {
      splash.dataset.state = 'leaving';
      removeTimer = window.setTimeout(() => {
        splash.remove();
      }, EXIT_MS);
    };

    const waitForPaint = () => {
      frameOne = window.requestAnimationFrame(() => {
        frameTwo = window.requestAnimationFrame(() => {
          exitTimer = window.setTimeout(releaseSplash, Math.max(0, MIN_BOOT_MS - elapsed));
        });
      });
    };

    waitForPaint();

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(removeTimer);
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
    };
  }, []);

  return null;
}
