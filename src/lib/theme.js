export const THEME_KEY = 'avalon.theme';
export const DEFAULT_THEME = 'dark';

export const THEME_CLASSES = [
  'dark',
  'daytime',
  'golden-hour',
  'warriors',
  'pride',
  'july',
  'light',
  'golden',
  'dubs',
];

export const THEME_ALIASES = {
  light: 'daytime',
  golden: 'golden-hour',
  dubs: 'warriors',
};

export const VALID_THEMES = ['dark', 'daytime', 'golden-hour', 'warriors', 'pride', 'july'];

export function normalizeTheme(theme) {
  const value = String(theme || '').trim();
  const normalized = THEME_ALIASES[value] || value;
  return VALID_THEMES.includes(normalized) ? normalized : DEFAULT_THEME;
}

export function readStoredTheme() {
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme = readStoredTheme(), { persist = true } = {}) {
  const normalized = normalizeTheme(theme);
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  root.classList.add(normalized);
  if (persist) {
    try {
      window.localStorage.setItem(THEME_KEY, normalized);
      window.localStorage.setItem('avalon.theme.v2', '1');
    } catch {
      // Storage can be unavailable in private windows; the theme still applies for this render.
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('avalon-theme-change', { detail: { theme: normalized } }));
  } catch {
    // CustomEvent can be unavailable in older embedded browsers; the root class still changed.
  }
  return normalized;
}
