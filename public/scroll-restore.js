(function () {
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  } catch (e) {}

  function stripHashAndTop() {
    try {
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    } catch (e) {}
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }

  stripHashAndTop();
  document.addEventListener('DOMContentLoaded', stripHashAndTop, { once: true });
  window.addEventListener('pageshow', stripHashAndTop);
  window.addEventListener('load', stripHashAndTop, { once: true });
  requestAnimationFrame(function () {
    requestAnimationFrame(stripHashAndTop);
  });
})();
