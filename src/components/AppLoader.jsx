import { useEffect } from 'react';

const MIN_BOOT_MS = 680;
const EXIT_MS = 380;
const HARD_REMOVE_MS = 1800;

function removeSplash() {
  const splash = document.getElementById('av-boot-splash');
  if (splash) splash.remove();
  window.__AV_BOOT_SPLASH_REMOVED = true;
}

function releaseSplash() {
  const splash = document.getElementById('av-boot-splash');
  if (!splash) return removeSplash();

  if (splash.dataset.state !== 'leaving') {
    splash.dataset.state = 'leaving';
  }

  window.clearTimeout(window.__AV_BOOT_SPLASH_REMOVE_TIMER);
  window.__AV_BOOT_SPLASH_REMOVE_TIMER = window.setTimeout(removeSplash, EXIT_MS);
  return undefined;
}

export default function AppLoader() {
  useEffect(() => {
    const splash = document.getElementById('av-boot-splash');
    if (!splash) return undefined;
    if (window.__AV_BOOT_SKIP_SPLASH) {
      removeSplash();
      document.documentElement.classList.remove('av-skip-boot');
      return undefined;
    }
    if (window.__AV_BOOT_SPLASH_REMOVED) {
      removeSplash();
      return undefined;
    }

    const bootStarted = Number(window.__AV_BOOT_STARTED_AT || 0) || Date.now();
    const elapsed = Date.now() - bootStarted;
    const releaseDelay = Math.max(0, MIN_BOOT_MS - elapsed);

    window.clearTimeout(window.__AV_BOOT_SPLASH_HARD_REMOVE_TIMER);
    window.__AV_BOOT_SPLASH_HARD_REMOVE_TIMER = window.setTimeout(removeSplash, HARD_REMOVE_MS);

    if (!window.__AV_BOOT_SPLASH_RELEASE_SCHEDULED) {
      window.__AV_BOOT_SPLASH_RELEASE_SCHEDULED = true;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.__AV_BOOT_SPLASH_RELEASE_TIMER = window.setTimeout(releaseSplash, releaseDelay);
        });
      });
    }

    return undefined;
  }, []);

  return null;
}
