(function () {
  window.__AV_BOOT_STARTED_AT = Date.now();
  document.documentElement.classList.add('av-js');
  // Seasonal and legacy themes are disabled. Always boot the base theme.
  var ALLOWED = ['dark'];
  try {
    var stored = window.localStorage.getItem('avalon.theme');
    var path = String(window.location.pathname || '/');
    var isAvalonOsBeta = String(window.location.hostname || '').toLowerCase() === 'beta.avalonvitality.co';
    var isPortal = /^\/(provider|admin|members|account)(\/|$)/.test(path)
      || /^\/(login|signup|forgot|forgot-password)(\/|$)/.test(path);
    if (isPortal) stored = 'dark';
    if (stored === 'dubs' || stored === 'warriors') stored = 'dark';
    var theme = (stored && ALLOWED.indexOf(stored) !== -1) ? stored : 'dark';
    // Rewrite storage so any legacy value (daytime/light/golden-hour/etc.)
    // never resurrects on a later paint.
    try { window.localStorage.setItem('avalon.theme', theme); } catch (_) {}
    try { window.localStorage.setItem('avalon.theme.v2', '1'); } catch (_) {}
    var cl = document.documentElement.classList;
    cl.remove('dark', 'giants', 'daytime', 'golden-hour', 'warriors', 'pride', 'july', 'light', 'golden', 'dubs');
    cl.add(theme);
    // Consumer cream theme (2026-07-29): every consumer page shares the new
    // snooches design. Set pre-paint so there's no dark flash before React
    // mounts; App.jsx keeps it in sync on client-side navigation.
    // Avalon OS beta carries the same cream/editorial language through every
    // role surface. Existing production portals remain dark.
    if (isAvalonOsBeta || (!isPortal && !/^\/(organizer|kiosk)(\/|$)/.test(path))) cl.add('av-cream');
    var nameFlag = '__AV_BOOT_SPLASH_SEEN__';
    var seenInSession = window.sessionStorage.getItem('av.bootSplashSeen') === '1';
    var skipOnce = window.sessionStorage.getItem('av.skipSplashOnce') === '1';
    var seenInTab = String(window.name || '').indexOf(nameFlag) !== -1;
    if (seenInSession || skipOnce || seenInTab) {
      window.sessionStorage.removeItem('av.skipSplashOnce');
      cl.add('av-skip-boot');
      window.__AV_BOOT_SKIP_SPLASH = true;
    } else {
      window.sessionStorage.setItem('av.bootSplashSeen', '1');
      window.name = window.name ? window.name + ' ' + nameFlag : nameFlag;
    }
  } catch (e) {
    window.__AV_THEME_BOOTSTRAP_ERROR = true;
  }
})();
