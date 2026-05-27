import { useState, useEffect } from 'react';

const THEME_PALETTES = {
  dark:   { bg: 'hsl(var(--background))', text: 'hsl(var(--foreground))', accent: 'hsl(var(--foreground))', sub: 'hsl(var(--foreground) / 0.45)' },
  light:  { bg: 'hsl(var(--background))', text: 'hsl(var(--foreground))', accent: 'hsl(var(--foreground))', sub: 'hsl(var(--foreground) / 0.45)' },
};

function getThemePalette() {
  try {
    const stored = window.localStorage.getItem('avalon.theme') || 'dark';
    return THEME_PALETTES[stored] ?? THEME_PALETTES.dark;
  } catch {
    return THEME_PALETTES.dark;
  }
}

export default function AppLoader() {
  const [visible, setVisible] = useState(true);

  // Resolved once — palette never changes during the splash
  const [palette] = useState(getThemePalette);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), 520);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <>
      {visible ? (
        <div
          style={{ backgroundColor: palette.bg }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background animate-in fade-in duration-base"
          role="status"
          aria-live="polite"
          aria-label="Loading Avalon Vitality"
          data-mobile-qa-ignore
        >
          <p
            style={{ color: palette.text, fontFamily: 'inherit' }}
            className="font-heading text-[18vw] leading-none tracking-[0.32em] pl-[0.32em] select-none animate-in fade-in slide-in-from-bottom-1 duration-reveal sm:text-[12vw] md:text-[8vw]"
          >
            AV
          </p>

          <p
            style={{ color: palette.sub }}
            className="font-body text-[10px] tracking-[0.4em] uppercase mt-2 select-none animate-in fade-in duration-reveal"
          >
            AVALON VITALITY
          </p>

          {/* Accent progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.06]">
            <div
              style={{ backgroundColor: palette.accent }}
              className="h-full origin-left animate-[av-loader-progress_320ms_cubic-bezier(0.16,1,0.3,1)_forwards]"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
