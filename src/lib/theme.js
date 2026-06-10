export const THEME_KEY = 'avalon.theme';
export const DEFAULT_THEME = 'daytime';

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
export const THEME_LABELS = {
  dark: 'Night',
  daytime: 'Daytime',
  'golden-hour': 'Golden',
  warriors: 'Warriors',
  pride: 'Pride',
  july: 'July',
};

const THEME_COLOR_SCHEMES = {
  dark: 'dark',
  daytime: 'light',
  'golden-hour': 'light',
  warriors: 'dark',
  pride: 'dark',
  july: 'dark',
};

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

export function getThemeLabel(theme) {
  return THEME_LABELS[normalizeTheme(theme)] || THEME_LABELS[DEFAULT_THEME];
}

export function applyTheme(theme = readStoredTheme(), { persist = true } = {}) {
  const normalized = normalizeTheme(theme);
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  root.classList.add(normalized);
  root.dataset.avalonMode = normalized;
  root.style.colorScheme = THEME_COLOR_SCHEMES[normalized] || 'dark';
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
