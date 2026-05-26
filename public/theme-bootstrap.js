(function () {
  var VALID = ['dark', 'light'];
  try {
    var stored = window.localStorage.getItem('avalon.theme');
    var theme = (stored && VALID.indexOf(stored) !== -1) ? stored : 'dark';
    var cl = document.documentElement.classList;
    cl.remove('dark', 'golden', 'dubs');
    if (theme !== 'light') cl.add(theme);
  } catch (e) {}
})();
