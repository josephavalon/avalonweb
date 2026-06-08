window.setTimeout(function () {
  var splash = document.getElementById('av-boot-splash');
  if (!splash) return;
  splash.dataset.state = 'leaving';
  window.setTimeout(function () {
    var currentSplash = document.getElementById('av-boot-splash');
    if (currentSplash) currentSplash.remove();
    window.__AV_BOOT_SPLASH_REMOVED = true;
  }, 180);
}, 450);
