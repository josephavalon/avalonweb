(function () {
  window.__AV_BOOT_STARTED_AT = Date.now();
  var VALID = ['dark', 'light'];
  try {
    var stored = window.localStorage.getItem('avalon.theme');
    var theme = (stored && VALID.indexOf(stored) !== -1) ? stored : 'dark';
    var cl = document.documentElement.classList;
    cl.remove('dark', 'golden', 'dubs');
    if (theme !== 'light') cl.add(theme);
    if (window.sessionStorage.getItem('av.skipSplashOnce') === '1') {
      window.sessionStorage.removeItem('av.skipSplashOnce');
      cl.add('av-skip-boot');
      window.__AV_BOOT_SKIP_SPLASH = true;
    }
  } catch (e) {
    window.__AV_THEME_BOOTSTRAP_ERROR = true;
  }
})();
