(function () {
  window.__AV_BOOT_STARTED_AT = Date.now();
  var VALID = ['dark', 'light'];
  try {
    var stored = window.localStorage.getItem('avalon.theme');
    var theme = (stored && VALID.indexOf(stored) !== -1) ? stored : 'dark';
    var cl = document.documentElement.classList;
    cl.remove('dark', 'golden', 'dubs');
    if (theme !== 'light') cl.add(theme);
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
