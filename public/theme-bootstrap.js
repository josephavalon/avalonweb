(function () {
  window.__AV_BOOT_STARTED_AT = Date.now();
  document.documentElement.classList.add('av-js');
  var VALID = ['dark', 'giants', 'daytime', 'golden-hour', 'warriors', 'pride', 'july', 'light', 'golden', 'dubs'];
  try {
    var stored = window.localStorage.getItem('avalon.theme');
    var path = String(window.location.pathname || '/');
    var isPortal = /^\/(provider|admin|members|account)(\/|$)/.test(path)
      || /^\/(login|signup|forgot|forgot-password)(\/|$)/.test(path);
    // Workforce/member screens must never inherit a promotional sports theme.
    // Reset before first paint so a saved Warriors preference cannot produce a
    // blue boot flash while a protected route redirects or restores a session.
    if (isPortal && stored !== 'dark') {
      stored = 'dark';
      window.localStorage.setItem('avalon.theme', 'dark');
      window.localStorage.setItem('avalon.theme.v2', '1');
    }
    var theme = (stored && VALID.indexOf(stored) !== -1) ? stored : 'dark';
    if (theme === 'light') theme = 'daytime';
    if (theme === 'golden') theme = 'golden-hour';
    if (theme === 'dubs') theme = 'warriors';
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
