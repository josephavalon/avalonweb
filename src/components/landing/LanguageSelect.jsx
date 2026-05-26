import React, { useState, useEffect, useRef } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE } from '@/lib/motion';

// Top 10 languages spoken in California
const LANGUAGES = [
  { code: 'en',    native: 'English',    label: 'English'    },
  { code: 'es',    native: 'Español',    label: 'Spanish'    },
  { code: 'zh-CN', native: '中文',        label: 'Chinese'    },
  { code: 'tl',    native: 'Filipino',   label: 'Filipino'   },
  { code: 'vi',    native: 'Tiếng Việt', label: 'Vietnamese' },
  { code: 'ko',    native: '한국어',       label: 'Korean'     },
  { code: 'hy',    native: 'Հայերեն',    label: 'Armenian'   },
  { code: 'fa',    native: 'فارسی',      label: 'Persian'    },
  { code: 'ja',    native: '日本語',      label: 'Japanese'   },
  { code: 'pa',    native: 'ਪੰਜਾਬੀ',     label: 'Punjabi'    },
];

const GOOGLE_TRANSLATE_SCRIPT_ID = 'avalon-google-translate-script';
const GOOGLE_TRANSLATE_LANGUAGES = LANGUAGES
  .filter((lang) => lang.code !== 'en')
  .map((lang) => lang.code)
  .join(',');

function getCookie(name) {
  const encodedName = encodeURIComponent(name).replace(/[-.+*]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${encodedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function getCurrentLang() {
  try {
    const value = getCookie('googtrans');
    const match = value.match(/^\/(?:auto|en)\/([^/;]+)$/);
    return match ? match[1] : 'en';
  } catch {
    return 'en';
  }
}

function rootDomain(hostname = '') {
  const parts = hostname.split('.').filter(Boolean);
  if (parts.length <= 2) return hostname;
  return parts.slice(-2).join('.');
}

function writeCookie(value, { domain, expires } = {}) {
  const pieces = [`googtrans=${value}`, 'path=/'];
  if (expires) pieces.push(`expires=${expires}`);
  if (domain) pieces.push(`domain=${domain}`);
  document.cookie = pieces.join('; ');
}

function setGoogleTranslateCookie(code) {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const past = 'Thu, 01 Jan 1970 00:00:00 UTC';
  if (code === 'en') {
    writeCookie('', { expires: past });
    if (!isLocalhost) {
      writeCookie('', { expires: past, domain: `.${hostname}` });
      writeCookie('', { expires: past, domain: `.${rootDomain(hostname)}` });
    }
  } else {
    // /auto/ source lets Google auto-detect the page language — more reliable than /en/
    const val = encodeURIComponent(`/auto/${code}`);
    writeCookie(val);
    if (!isLocalhost) {
      writeCookie(val, { domain: `.${rootDomain(hostname)}` });
    }
  }
}

function ensureGoogleTranslateTarget() {
  if (document.getElementById('google_translate_element')) return;
  const target = document.createElement('div');
  target.id = 'google_translate_element';
  target.style.cssText = 'display:none;visibility:hidden;position:absolute;';
  document.body.appendChild(target);
}

function loadGoogleTranslate() {
  if (typeof window === 'undefined') return;
  ensureGoogleTranslateTarget();

  window.googleTranslateElementInit = () => {
    if (!window.google?.translate?.TranslateElement) return;
    new window.google.translate.TranslateElement({
      pageLanguage: 'en',
      includedLanguages: GOOGLE_TRANSLATE_LANGUAGES,
      autoDisplay: false,
      gaTrack: false,
    }, 'google_translate_element');
  };

  if (document.getElementById(GOOGLE_TRANSLATE_SCRIPT_ID)) {
    window.googleTranslateElementInit();
    return;
  }

  const script = document.createElement('script');
  script.id = GOOGLE_TRANSLATE_SCRIPT_ID;
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  script.async = true;
  script.defer = true;
  document.body.appendChild(script);
}

// Inline variant — sits in the footer, not fixed to the viewport.
// Dropdown opens upward (bottom-full) so it doesn't get clipped by page bottom.
export default function LanguageSelect() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('en');
  const ref = useRef(null);

  useEffect(() => { setCurrent(getCurrentLang()); }, []);

  useEffect(() => {
    document.documentElement.lang = current;
    if (current !== 'en') loadGoogleTranslate();
  }, [current]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (code) => {
    setOpen(false);
    if (code === current) return;
    setGoogleTranslateCookie(code);
    window.location.reload();
  };

  const currentLang = LANGUAGES.find((l) => l.code === current) || LANGUAGES[0];

  return (
    <div ref={ref} className="relative inline-block notranslate" translate="no">
      {/* Trigger */}
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.97, transition: { duration: 0.22, ease: EASE } }}
        aria-label="Select language"
        aria-expanded={open}
        data-current-language={current}
        className="flex min-h-11 items-center gap-1.5 rounded-full border border-foreground/[0.12] px-3 py-2 font-body text-[10px] uppercase tracking-[0.15em] text-foreground/45 transition-colors duration-200 hover:border-foreground/25 hover:text-foreground"
      >
        <Globe className="w-3 h-3 shrink-0" strokeWidth={1.8} />
        <span>{currentLang.native}</span>
        <ChevronDown
          className={`w-2.5 h-2.5 shrink-0 transition-transform duration-200 ${open ? '-rotate-180' : ''}`}
          strokeWidth={2}
        />
      </motion.button>

      {/* Dropdown — opens upward */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="absolute bottom-full mb-2 left-0 w-44 rounded-2xl bg-background border border-foreground/[0.09] shadow-[0_-4px_32px_hsl(var(--foreground)/0.14)] overflow-hidden z-50"
            role="listbox"
            aria-label="Language options"
          >
            {LANGUAGES.map((lang) => {
              const active = current === lang.code;
              return (
                <button
                  key={lang.code}
                  role="option"
                  aria-selected={active}
                  onClick={() => select(lang.code)}
                  data-lang-code={lang.code}
                  className={`flex min-h-11 w-full items-center justify-between px-4 py-2.5 font-body text-[11px] transition-colors hover:bg-foreground/[0.05] ${
                    active ? 'text-foreground' : 'text-foreground/50'
                  }`}
                >
                  <span>{lang.native}</span>
                  {active && <Check className="w-3 h-3 shrink-0" strokeWidth={2.5} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
