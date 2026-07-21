import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Save, Search, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import PageShell from '@/components/admin/PageShell';
import { apiGet } from '@/lib/apiClient';
import {
  HUBSPOT_GUEST_PROFILE_FIELDS,
  checkHubspotConnection,
  saveGuestProfile,
} from '@/lib/hubspotPlaceholder';

const EMPTY_GUEST_PROFILE = {
  instagram: '',
  tiktok: '',
  linkedin: '',
  beverage: '',
  music: '',
  style: '',
  wardrobe: '',
  context: '',
  notes: '',
};

function ConnectionTile({ status, onRefresh, checking }) {
  const tone = status?.ok
    ? 'border-emerald-300/25 bg-emerald-300/[0.045] text-emerald-200'
    : status?.syncEnabled === false
      ? 'border-amber-300/25 bg-amber-300/[0.055] text-amber-200'
      : 'border-red-400/25 bg-red-500/[0.055] text-red-300';
  const label = status?.ok
    ? 'Connected'
    : status?.syncEnabled === false
      ? 'Kill switch off (HUBSPOT_SYNC_ENABLED)'
      : status?.error || 'Not connected';
  return (
    <div className={`av-glass rounded-xl border p-4 ${tone}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] opacity-70">HubSpot connection</p>
        <ShieldCheck className="h-4 w-4 shrink-0 opacity-60" strokeWidth={1.6} />
      </div>
      <p className="font-heading text-2xl uppercase leading-none tracking-tight text-foreground">{label}</p>
      <p className="mt-2 font-body text-[11px] leading-snug text-foreground/60">
        Portal {status?.portalId || '—'} · Configured: {status?.configured ? 'yes' : 'no'} · Sync: {status?.syncEnabled ? 'on' : 'off'}
      </p>
      <button
        type="button"
        onClick={onRefresh}
        disabled={checking}
        className="mt-3 inline-flex min-h-[32px] items-center gap-2 rounded-full border border-foreground/14 bg-background/48 px-3 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/64 transition-colors hover:text-foreground disabled:opacity-40"
      >
        <RefreshCw className={`h-3 w-3 ${checking ? 'animate-spin' : ''}`} strokeWidth={2} />
        Recheck
      </button>
    </div>
  );
}

function ClientLookup({ onLoad, loading, error }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) onLoad(q);
      }}
      className="rounded-xl border border-foreground/10 bg-background/58 p-4"
    >
      <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/50">Load client</p>
      <p className="mt-1 font-body text-[11px] text-foreground/54">
        Enter a client's email or profile UUID. Only the identifiers + hospitality profile are loaded — no clinical data.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="client@example.com or profile-uuid"
          className="min-w-[240px] flex-1 rounded-full border border-foreground/12 bg-background/45 px-4 py-2 font-body text-[12px] text-foreground placeholder:text-foreground/38"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={2} />
          {loading ? 'Loading…' : 'Load'}
        </button>
      </div>
      {error && (
        <p className="mt-3 font-body text-[11px] text-red-300">{error}</p>
      )}
    </form>
  );
}

function GuestProfileEditor({ profile, onSave, saving, saveError, saveNote }) {
  const [values, setValues] = useState(() => ({ ...EMPTY_GUEST_PROFILE, ...(profile?.guestProfile || {}) }));

  useEffect(() => {
    setValues({ ...EMPTY_GUEST_PROFILE, ...(profile?.guestProfile || {}) });
  }, [profile?.id]);

  const set = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.05] p-4">
        <div className="mb-2 flex items-center gap-2 text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
          <p className="font-body text-[10px] font-semibold uppercase tracking-[0.18em]">
            Hospitality profile — no medical notes
          </p>
        </div>
        <p className="font-body text-[11px] text-amber-100/80">
          This is a hospitality dossier, not a chart. Health-related terms (allergies, medications, diagnosis,
          symptoms, prescriptions) will be refused by the server. Store all clinical detail in the patient
          chart, never here.
        </p>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-background/58 p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/50">Client</p>
            <p className="mt-1 font-heading text-2xl uppercase leading-none tracking-tight text-foreground">
              {profile?.fullName || profile?.preferredName || '—'}
            </p>
            <p className="mt-1 font-body text-[11px] text-foreground/54">
              {[profile?.email, profile?.phone].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="text-right">
            <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/50">HubSpot</p>
            <p className="mt-1 font-body text-[11px] text-foreground/64">
              {profile?.hubspotContactId ? (
                <>Contact <span className="rounded-full border border-foreground/14 bg-background/45 px-2 py-0.5 font-mono text-[10px] text-foreground/78">{profile.hubspotContactId}</span></>
              ) : (
                <span className="text-foreground/40">Not synced yet</span>
              )}
            </p>
            {profile?.hubspotSyncedAt && (
              <p className="mt-1 font-body text-[10px] text-foreground/44">
                Last synced {new Date(profile.hubspotSyncedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {HUBSPOT_GUEST_PROFILE_FIELDS.map((field) => (
            <div key={field.key} className={field.kind === 'long' ? 'md:col-span-2' : ''}>
              <label className="mb-1 block font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/54">
                {field.label}
              </label>
              {field.kind === 'long' ? (
                <textarea
                  value={values[field.key] || ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-foreground/12 bg-background/45 px-3 py-2 font-body text-[12px] text-foreground placeholder:text-foreground/38"
                />
              ) : (
                <input
                  type="text"
                  value={values[field.key] || ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-full border border-foreground/12 bg-background/45 px-4 py-2 font-body text-[12px] text-foreground placeholder:text-foreground/38"
                  autoComplete="off"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-body text-[10px] text-foreground/44">
            Saved via <span className="font-mono">/api/admin/guest-profile</span> → mirrored to HubSpot.
          </p>
          <button
            type="button"
            onClick={() => onSave(values)}
            disabled={saving}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-foreground/18 bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {saving ? 'Saving…' : 'Save & sync to HubSpot'}
          </button>
        </div>

        {saveError && (
          <p className="mt-3 rounded-lg border border-red-400/25 bg-red-500/[0.05] px-3 py-2 font-body text-[11px] text-red-300">
            {saveError}
          </p>
        )}
        {saveNote && !saveError && (
          <p className="mt-3 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.05] px-3 py-2 font-body text-[11px] text-emerald-200">
            <CheckCircle2 className="mr-1 inline h-3 w-3" strokeWidth={2} /> {saveNote}
          </p>
        )}
      </div>
    </div>
  );
}

export default function HubspotControl() {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);

  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNote, setSaveNote] = useState('');

  const runConnectionCheck = useCallback(async () => {
    setChecking(true);
    try {
      const res = await checkHubspotConnection();
      setStatus(res);
    } catch (err) {
      setStatus({ ok: false, error: err?.message || 'Connection check failed' });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { runConnectionCheck(); }, [runConnectionCheck]);

  const handleLoadClient = async (query) => {
    setLoading(true);
    setLoadError('');
    setSaveNote('');
    setSaveError('');
    try {
      const res = await apiGet(`/api/admin/clients/${encodeURIComponent(query)}`);
      if (!res?.client) throw new Error('No client returned for that email/uuid');
      setProfile(res.client);
    } catch (err) {
      setLoadError(err?.message || 'Could not load client.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (guestProfile) => {
    if (!profile?.id) return;
    setSaving(true);
    setSaveError('');
    setSaveNote('');
    try {
      const res = await saveGuestProfile({ profileId: profile.id, guestProfile });
      if (!res?.ok) throw new Error(res?.error || 'Save failed');
      setProfile((prev) => (prev ? {
        ...prev,
        guestProfile: res.guestProfile,
        hubspotContactId: res.hubspot?.id || prev.hubspotContactId,
        hubspotSyncedAt: res.hubspot?.skipped ? prev.hubspotSyncedAt : new Date().toISOString(),
      } : prev));
      const hubspotNote = res.hubspot?.skipped
        ? ' (HubSpot sync kill-switched off — DB updated, CRM will backfill when enabled)'
        : res.hubspot?.id ? ' · HubSpot contact synced.' : '';
      setSaveNote(`Guest profile saved.${hubspotNote}`);
    } catch (err) {
      setSaveError(err?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell title="HubSpot">
      <PageShell embedded
        eyebrow="HubSpot Hospitality CRM"
        title="Guest Profiles"
        subtitle="Identifiers + hospitality preferences only. No clinical data."
      >
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ConnectionTile status={status} onRefresh={runConnectionCheck} checking={checking} />
            <div className="av-glass rounded-xl border border-foreground/10 bg-background/58 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="font-body text-[9px] font-semibold uppercase tracking-[0.22em] text-foreground/60">What lands in HubSpot</p>
                <Sparkles className="h-4 w-4 shrink-0 text-foreground/44" strokeWidth={1.6} />
              </div>
              <ul className="space-y-1 font-body text-[11px] text-foreground/70">
                <li>• Name, email, phone, city</li>
                <li>• Source, lifecycle stage, plan interest, visit count</li>
                <li>• Social handles (Instagram, TikTok, LinkedIn)</li>
                <li>• Beverage, music, style, wardrobe</li>
                <li>• Hospitality notes + visit context</li>
                <li>• Consent timestamps (NPP + terms)</li>
              </ul>
            </div>
          </div>

          <ClientLookup onLoad={handleLoadClient} loading={loading} error={loadError} />

          {profile && (
            <GuestProfileEditor
              profile={profile}
              onSave={handleSave}
              saving={saving}
              saveError={saveError}
              saveNote={saveNote}
            />
          )}

          {!profile && !loadError && (
            <div className="rounded-xl border border-dashed border-foreground/12 bg-background/38 p-6 text-center">
              <UserRound className="mx-auto mb-3 h-6 w-6 text-foreground/38" strokeWidth={1.4} />
              <p className="font-body text-[12px] text-foreground/54">
                Load a client above to edit their hospitality profile.
              </p>
            </div>
          )}
        </div>
      </PageShell>
    </AdminShell>
  );
}
