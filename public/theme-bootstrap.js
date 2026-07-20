(function () {
  window.__AV_BOOT_STARTED_AT = Date.now();
  document.documentElement.classList.add('av-js');
  // Only `dark` and `warriors` are user-facing. Anything else (daytime,
  // golden-hour, light, giants, pride, july, dubs, golden) resolves back to
  // dark — the site must never boot with a light theme flash.
  var ALLOWED = ['dark', 'warriors'];
  try {
    var stored = window.localStorage.getItem('avalon.theme');
    var path = String(window.location.pathname || '/');
    var isPortal = /^\/(provider|admin|members|account)(\/|$)/.test(path)
      || /^\/(login|signup|forgot|forgot-password)(\/|$)/.test(path);
    if (isPortal) stored = 'dark';
    if (stored === 'dubs') stored = 'warriors';
    var theme = (stored && ALLOWED.indexOf(stored) !== -1) ? stored : 'dark';
    // Rewrite storage so any legacy value (daytime/light/golden-hour/etc.)
    // never resurrects on a later paint.
    try { window.localStorage.setItem('avalon.theme', theme); } catch (_) {}
    try { window.localStorage.setItem('avalon.theme.v2', '1'); } catch (_) {}
    var cl = document.documentElement.classList;
    cl.remove('dark', 'giants', 'daytime', 'golden-hour', 'warriors', 'pride', 'july', 'light', 'golden', 'dubs');
    cl.add(theme);
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
