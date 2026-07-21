import React, { useEffect, useId, useRef, useState } from 'react';

// Reusable street-address autocomplete input. Wraps a controlled <input> and,
// as the user types, queries the existing keyless /api/address-search endpoint
// (OSM / Nominatim — NOT Google, no API key). It shows a dropdown of matches
// and, on select, fills the street line + hands the structured parts
// (city / state / zip / composed label) back to the parent via onSelect.
//
// It is fully additive: the user can always type freely, and if the endpoint
// errors or returns nothing it degrades to a plain text input. The visual
// styling is driven entirely by the `className` you pass (use the host page's
// existing inputClass so it matches the surrounding fields).
//
// Props:
//   value        string   — controlled street-line text (required)
//   onChange     (text)            => void  — raw text edits (required)
//   onSelect     ({ street, city, state, zip, label }) => void — on suggestion pick
//   className    string   — input class (pass the page's inputClass)
//   minChars     number   — min chars before querying (default 3)
//   debounceMs   number   — debounce delay (default 300)
//   ...rest      — any extra <input> props (placeholder, autoComplete, id, etc.)

const DEFAULT_MIN_CHARS = 3;
const DEFAULT_DEBOUNCE = 300;

export default function AddressAutocomplete({
  value = '',
  onChange,
  onSelect,
  className,
  minChars = DEFAULT_MIN_CHARS,
  debounceMs = DEFAULT_DEBOUNCE,
  ...rest
}) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // True only right after a pick, so we don't immediately re-query the
  // selected address text and re-open the dropdown.
  const justSelectedRef = useRef(false);

  const rootRef = useRef(null);
  const abortRef = useRef(null);
  const listId = useId();

  // Debounced lookup against the keyless /api/address-search endpoint.
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    const q = (value || '').trim();
    if (q.length < minChars) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(`/api/address-search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data || !Array.isArray(data.results)) {
          // Degrade silently to a plain text input.
          setErrored(true);
          setResults([]);
          setOpen(false);
          return;
        }
        setErrored(false);
        setResults(data.results);
        setActiveIndex(-1);
        setOpen(true);
      } catch (err) {
        if (cancelled || err?.name === 'AbortError') return;
        setErrored(true);
        setResults([]);
        setOpen(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, minChars, debounceMs]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return undefined;
    const onDocPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, [open]);

  const pick = (item) => {
    if (!item) return;
    justSelectedRef.current = true;
    onChange?.(item.street || item.label || '');
    onSelect?.(item);
    setOpen(false);
    setResults([]);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        pick(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const showDropdown = open && (loading || results.length > 0 || (!errored && value.trim().length >= minChars));

  return (
    <div ref={rootRef} className="relative">
      <input
        {...rest}
        className={className}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        autoComplete={rest.autoComplete || 'off'}
      />

      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-72 overflow-auto rounded-xl border border-foreground/16 bg-background/95 py-1 shadow-[0_24px_70px_hsl(var(--background)/0.7)] backdrop-blur-xl"
        >
          {loading && results.length === 0 && (
            <li className="px-3.5 py-2.5 font-body text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground/45">
              Searching…
            </li>
          )}

          {!loading && results.length === 0 && (
            <li className="px-3.5 py-2.5 font-body text-[13px] font-semibold uppercase tracking-[0.08em] text-foreground/45">
              No matches — keep typing
            </li>
          )}

          {results.map((item, i) => (
            <li
              key={item.label || `${item.street}-${i}`}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // onMouseDown (not onClick) so the pick fires before the input
              // blur closes the dropdown.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-3.5 py-2.5 font-body text-sm font-semibold text-foreground/85 ${
                i === activeIndex ? 'bg-foreground/12 text-foreground' : ''
              }`}
            >
              <span className="block truncate">{item.street}</span>
              <span className="mt-0.5 block truncate font-body text-[12px] font-medium uppercase tracking-[0.06em] text-foreground/45">
                {[item.city, [item.state, item.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
