/**
 * GFE — /admin/gfe
 *
 * Per-category GFE policy. Toggle a category ON → Qualiphy auto-conducts the
 * Good Faith Exam for every patient who books in it (unless they already have a
 * valid one on file). Toggle OFF → an Avalon NP does the GFE directly in Acuity.
 * Either way the GFE ends up on the Acuity appointment and syncs to the patient
 * profile for fast checkout.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, CheckCircle2, Stethoscope, Save } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { apiGet, apiPost } from '@/lib/apiClient';

const BG = 'hsl(var(--background))';
const TEXT = 'hsl(var(--foreground))';
const INVERT = 'hsl(var(--background))';
const MUTED = 'hsl(var(--foreground) / 0.62)';
const DIM = 'hsl(var(--foreground) / 0.4)';
const CARD = 'hsl(var(--foreground) / 0.045)';
const CARD_STRONG = 'hsl(var(--foreground) / 0.08)';
const BORDER = 'hsl(var(--foreground) / 0.1)';
const ACCENT = 'hsl(150 60% 42%)';

const CATEGORIES = [
  { key: 'mobile', label: 'Mobile', detail: 'One-time mobile IV / IM visits' },
  { key: 'plan', label: 'Plan', detail: 'Subscriptions & memberships' },
  { key: 'events', label: 'Events', detail: 'Event & group bookings' },
];

function Toggle({ on, onClick, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      role="switch"
      aria-checked={on}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50"
      style={{ background: on ? ACCENT : 'hsl(var(--foreground) / 0.18)' }}
    >
      <span className="inline-block h-5 w-5 rounded-full bg-white transition-transform" style={{ transform: on ? 'translateX(22px)' : 'translateX(3px)' }} />
    </button>
  );
}

export default function GfeSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/admin/gfe/settings');
      setSettings(data?.settings || null);
    } catch {
      setResult({ tone: 'error', message: 'Could not load GFE settings.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next) => {
    setSaving(true);
    setResult(null);
    try {
      const data = await apiPost('/api/admin/gfe/settings', next);
      if (data?.ok) {
        setSettings(data.settings);
        setResult({ tone: 'success', message: 'Saved.' });
      } else {
        setResult({ tone: 'error', message: data?.error || 'Could not save.' });
      }
    } catch (err) {
      setResult({ tone: 'error', message: err?.body?.error || 'Could not save.' });
    } finally {
      setSaving(false);
    }
  }, []);

  const toggle = (key) => {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    save({ [key]: next[key] });
  };

  return (
    <AdminShell title="GFE">
      <div className="min-h-dvh font-body" style={{ background: BG, color: TEXT }}>
        <div className="mx-auto max-w-3xl px-4 py-2 md:px-8 md:py-3">
          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl px-4 py-4" style={{ background: CARD, border: `1px solid ${BORDER}`, color: MUTED }}>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> Loading…
            </div>
          ) : settings ? (
            <>
              <div className="grid gap-3">
                {CATEGORIES.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-4 rounded-2xl px-4 py-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                    <div className="min-w-0">
                      <p className="font-heading text-lg uppercase leading-none">{c.label}</p>
                      <p className="mt-1.5 font-body text-xs" style={{ color: DIM }}>{c.detail}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-body text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: settings[c.key] ? ACCENT : DIM }}>
                        {settings[c.key] ? 'Qualiphy auto' : 'NP in Acuity'}
                      </span>
                      <Toggle on={settings[c.key]} onClick={() => toggle(c.key)} busy={saving} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl px-4 py-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
                <p className="font-body text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: DIM }}>Qualiphy</p>
                <p className="mt-1 font-body text-sm" style={{ color: MUTED }}>
                  Clinic <span style={{ color: TEXT }}>{settings.clinicId}</span> · GFE exam id{settings.examIds?.length === 1 ? '' : 's'} <span style={{ color: TEXT }}>{(settings.examIds || []).join(', ')}</span>
                </p>
                <p className="mt-1 font-body text-[11px]" style={{ color: DIM }}>Default exam 4106 — Clinical Evaluation for Longevity &amp; Wellness (IV/IM Nutrient Therapy).</p>
              </div>

              {result ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}`, color: result.tone === 'error' ? 'hsl(0 70% 62%)' : ACCENT }}>
                  {result.tone === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} /> : <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />}
                  <span className="font-body text-sm">{result.message}</span>
                </div>
              ) : null}

              <div className="mt-6 flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: CARD_STRONG, border: `1px solid ${BORDER}` }}>
                <Stethoscope className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} style={{ color: MUTED }} />
                <p className="font-body text-xs leading-relaxed" style={{ color: MUTED }}>
                  Turn a category <span style={{ color: TEXT }}>ON</span> and Qualiphy auto-conducts the Good Faith Exam for patients
                  who book in it (skipped if they already have a valid GFE on file). <span style={{ color: TEXT }}>OFF</span> → an Avalon
                  NP does the GFE in Acuity. Either way it lands on the Acuity appointment and syncs to the patient profile.
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-2xl px-4 py-10 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="font-body text-sm" style={{ color: MUTED }}>Could not load settings.</p>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
