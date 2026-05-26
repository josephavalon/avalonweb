import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export const ADMIN_COMMAND_EASE = [0.16, 1, 0.3, 1];
export const TODAY_LABEL = new Date()
  .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  .replace(',', ' ·');

const THEMES = ['dark', 'light'];
const THEME_KEY = 'avalon.theme';

function readTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored && THEMES.includes(stored)) return stored;
  } catch (err) {
    if (import.meta.env?.DEV) console.warn('[admin-command-theme-read]', err);
  }
  return 'dark';
}

export function useAdminTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'golden', 'dubs');
    if (theme !== 'light') document.documentElement.classList.add(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (err) {
      if (import.meta.env?.DEV) console.warn('[admin-command-theme-write]', err);
    }
  }, [theme]);
  const cycle = () => setTheme((prev) => THEMES[(THEMES.indexOf(prev) + 1) % THEMES.length]);
  const Icon = theme === 'dark' ? Sun : Moon;
  return { theme, cycle, Icon };
}

const ACCENT_CLS = 'bg-accent/[0.08] text-accent border-accent/20';
const ACCENT_DOT = 'bg-accent/70';
const NEUTRAL_CLS = 'bg-foreground/[0.045] text-foreground/58 border-foreground/[0.12]';
const NEUTRAL_DOT = 'bg-foreground/35';
const DANGER_CLS = 'bg-red-400/[0.10] text-red-400 border-red-400/30';
const DANGER_DOT = 'bg-red-400';

const STATUS_CONFIG = {
  Confirmed: { cls: ACCENT_CLS, dot: ACCENT_DOT },
  Completed: { cls: ACCENT_CLS, dot: ACCENT_DOT },
  Paid: { cls: ACCENT_CLS, dot: ACCENT_DOT },
  Cleared: { cls: ACCENT_CLS, dot: ACCENT_DOT },
  'Ready for Visit': { cls: ACCENT_CLS, dot: ACCENT_DOT },
  Ready: { cls: ACCENT_CLS, dot: ACCENT_DOT },
  Available: { cls: ACCENT_CLS, dot: ACCENT_DOT },
  Won: { cls: ACCENT_CLS, dot: ACCENT_DOT },
  'New Request': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  Contacted: { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Clearance Pending': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Intake Pending': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Consent Pending': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Nurse Assigned': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  Assigned: { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Follow-Up Due': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Follow-Up': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Link Sent': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  Pending: { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  Invoice: { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Low Stock': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Check Expiry': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Off Duty': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  Lost: { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  New: { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Proposal Needed': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'Active Placeholder': { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  Interested: { cls: NEUTRAL_CLS, dot: NEUTRAL_DOT },
  'GFE Pending': { cls: DANGER_CLS, dot: DANGER_DOT },
  'Payment Pending': { cls: DANGER_CLS, dot: DANGER_DOT },
  Cancelled: { cls: DANGER_CLS, dot: DANGER_DOT },
  Overdue: { cls: DANGER_CLS, dot: DANGER_DOT },
  'Restock Needed': { cls: DANGER_CLS, dot: DANGER_DOT },
};

export function pill(status) {
  return STATUS_CONFIG[status] || { cls: 'bg-foreground/8 text-foreground/50 border-foreground/10', dot: 'bg-foreground/30' };
}
