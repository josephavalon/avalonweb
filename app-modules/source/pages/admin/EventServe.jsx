import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/apiClient';
import { EVENT_TONES, MONO_STACK, gfeStatusChip } from '@/lib/eventStatus';
import { useSeo } from '@/lib/seo';

/**
 * /admin/events/:slug/serve — door + station console (blueprint §6.2) and the
 * live queue console (§6.3.2). STILL regime (DESIGN.md): dense, instant,
 * zero animation — operators need speed, not brand.
 *
 * Offline posture (§2.3): the manifest is downloaded up front and cached in
 * localStorage; when the network dies, lookups run against the cached
 * manifest with the sync time displayed. Anything ambiguous offline renders
 * VERIFY WITH LEAD — never a false green.
 */

const STATIONS = [
  ['flow', 'IV CHAIRS'],
  ['express', 'SHOT BAR'],
  ['experience', 'CHECK-IN'],
];

const mono = (extra = {}) => ({ fontFamily: MONO_STACK, ...extra });

function VerdictCard({ verdict, onCheckin, busy }) {
  if (!verdict) return null;
  const { result, visit, offline } = verdict;
  const stop = result === 'clearance_stop' || result === 'invalid_token' || result === 'replayed_or_rotated_token' || result === 'not_found';
  const warn = result === 'verify_with_lead' || result === 'already_served' || offline;
  const ok = (result === 'scanned' && visit?.clearance?.allowed) || result === 'served';
  const color = stop ? EVENT_TONES.stop : ok && !warn ? EVENT_TONES.live : '#F5B85A';
  const headline = result === 'served' ? 'CHECKED IN'
    : result === 'already_served' ? 'ALREADY SERVED'
    : result === 'not_found' ? 'NOT ON THIS EVENT'
    : result === 'invalid_token' ? 'INVALID CODE'
    : result === 'replayed_or_rotated_token' ? 'STALE CODE — VERIFY WITH LEAD'
    : result === 'verify_with_lead' ? 'VERIFY WITH LEAD'
    : visit?.clearance?.allowed ? 'CLEARED FOR THIS STATION' : 'STOP — SEE CLINICAL LEAD';

  return (
    <div className="mt-4 rounded-xl border p-5" style={{ borderColor: color, background: 'rgba(13,13,13,0.94)' }}>
      <p className="text-lg font-medium" style={mono({ color, letterSpacing: '0.06em' })}>{headline}</p>
      {visit ? (
        <>
          <p className="mt-3 font-heading text-4xl uppercase leading-none text-foreground">{visit.name}</p>
          <p className="mt-2 text-xs text-foreground/60" style={mono({ letterSpacing: '0.06em' })}>
            {[visit.serviceName?.toUpperCase() || 'EXPERIENCE', `GFE: ${String(visit.gfeStatus || '—').toUpperCase()}`, visit.status?.toUpperCase(), offline ? 'OFFLINE MANIFEST' : null]
              .filter(Boolean).join(' · ')}
          </p>
          {visit.clearance && !visit.clearance.allowed && visit.clearance.reason ? (
            <p className="mt-2 text-xs" style={mono({ color: EVENT_TONES.stop })}>{String(visit.clearance.reason).toUpperCase()}</p>
          ) : null}
          {result === 'scanned' && visit.clearance?.allowed && !offline ? (
            <button type="button" disabled={busy} onClick={onCheckin}
              className="mt-4 w-full rounded-full bg-foreground py-4 font-body text-sm font-bold uppercase text-background disabled:opacity-50">
              Check in
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function EventServe() {
  const { slug = '' } = useParams();
  const [tab, setTab] = useState('serve');
  const [station, setStation] = useState('flow');
  const [manifest, setManifest] = useState(null);
  const [online, setOnline] = useState(true);
  const [lookup, setLookup] = useState('');
  const [verdict, setVerdict] = useState(null);
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState([]);
  const [notice, setNotice] = useState('');

  useSeo({ title: 'Serve — Avalon Events', description: 'Door and station console.', path: `/admin/events/${slug}/serve`, robots: 'noindex,nofollow' });

  const loadManifest = useCallback(async () => {
    try {
      const body = await apiGet(`/api/events/manifest?slug=${encodeURIComponent(slug)}`);
      if (body.ok) {
        setManifest(body.manifest);
        try { localStorage.setItem(`av.events.manifest.${slug}`, JSON.stringify(body.manifest)); } catch { /* storage full — in-memory still works */ }
        setOnline(true);
      }
    } catch {
      setOnline(false);
      try {
        const cached = localStorage.getItem(`av.events.manifest.${slug}`);
        if (cached) setManifest(JSON.parse(cached));
      } catch { /* no cache — manual verify only */ }
    }
  }, [slug]);

  const loadQueue = useCallback(async () => {
    try {
      const body = await apiGet(`/api/events/queue?slug=${encodeURIComponent(slug)}`);
      if (body.ok) { setQueue(body.entries || []); setOnline(true); }
    } catch { setOnline(false); }
  }, [slug]);

  useEffect(() => { loadManifest(); }, [loadManifest]);
  useEffect(() => {
    if (tab !== 'queue') return undefined;
    loadQueue();
    const t = setInterval(loadQueue, 15000);
    return () => clearInterval(t);
  }, [tab, loadQueue]);

  // Offline manifest lookup: by name or visit-ref prefix. Anything not a
  // clean single match is VERIFY WITH LEAD — never a guessy green.
  const offlineMatches = useMemo(() => {
    if (!manifest || !lookup.trim()) return [];
    const q = lookup.trim().toLowerCase();
    return manifest.visits.filter((v) => v.name.toLowerCase().includes(q) || v.visitId.toLowerCase().startsWith(q));
  }, [manifest, lookup]);

  async function scan(ref) {
    setBusy(true); setVerdict(null);
    try {
      const body = await apiPost('/api/events/serve', { slug, station, action: 'scan', ...(ref.token ? { token: ref.token } : { visitId: ref.visitId }) });
      setVerdict(body); setOnline(true);
    } catch {
      setOnline(false);
      // Offline: render from the cached manifest, conservatively.
      const v = manifest?.visits.find((m) => m.visitId === ref.visitId);
      if (!v) { setVerdict({ result: 'verify_with_lead', offline: true }); }
      else {
        const allowed = station === 'experience' || (v.gfeStatus === 'cleared' && (Object.keys(v.gfeScope || {}).length === 0 || (station === 'flow' ? v.gfeScope.iv : v.gfeScope.im)));
        setVerdict({
          result: v.status === 'confirmed' ? 'scanned' : 'verify_with_lead',
          offline: true,
          visit: { ...v, clearance: { allowed: allowed && v.status === 'confirmed' } },
        });
      }
    } finally { setBusy(false); }
  }

  async function checkin() {
    if (!verdict?.visit?.visitId) return;
    setBusy(true);
    try {
      const body = await apiPost('/api/events/serve', { slug, station, action: 'checkin', visitId: verdict.visit.visitId });
      setVerdict(body);
    } catch { setNotice('Check-in failed — retry when back online.'); }
    finally { setBusy(false); }
  }

  async function queueAction(action, entryId, extra = {}) {
    setNotice('');
    try {
      const body = await apiPost('/api/events/queue', { slug, action, entryId, ...extra });
      if (body.ok === false) setNotice(body.error || 'Action failed.');
      if (body.result === 'queue_empty') setNotice('Queue is empty.');
      await loadQueue();
    } catch (err) { setNotice(err.message || 'Action failed.'); }
  }

  const btn = 'rounded-full border border-white/14 px-3 py-2 text-[11px] uppercase text-foreground/80 hover:border-white/30';

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-4xl uppercase leading-none">Serve · {slug}</h1>
          <span className="text-[10px] uppercase" style={mono({ color: online ? EVENT_TONES.live : EVENT_TONES.stop, letterSpacing: '0.1em' })}>
            {online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        <p className="mt-1 text-[10px] uppercase text-foreground/45" style={mono({ letterSpacing: '0.1em' })}>
          {manifest ? `MANIFEST SYNCED ${new Date(manifest.generatedAt).toLocaleTimeString()} · ${manifest.visits.length} GUESTS · ${manifest.mode === 'ed25519' ? `KEY ${manifest.keyId}` : 'PLACEHOLDER MODE — ONLINE VERIFY ONLY'}` : 'NO MANIFEST — DOWNLOAD BEFORE DOORS'}
        </p>

        <div className="mt-4 flex gap-2">
          {['serve', 'queue'].map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2.5 text-xs font-bold uppercase ${tab === t ? 'bg-foreground text-background' : 'border border-white/14 text-foreground/70'}`}>
              {t === 'serve' ? 'Door / Stations' : 'GFE Queue'}
            </button>
          ))}
          <button type="button" onClick={loadManifest} className={`${btn} ml-auto`} style={mono()}>SYNC MANIFEST</button>
        </div>

        {tab === 'serve' ? (
          <div className="mt-5">
            <div className="flex gap-2">
              {STATIONS.map(([key, label]) => (
                <button key={key} type="button" onClick={() => { setStation(key); setVerdict(null); }}
                  className={`flex-1 rounded-xl border py-3 text-xs uppercase ${station === key ? 'border-foreground text-foreground' : 'border-white/14 text-foreground/55'}`}
                  style={mono({ letterSpacing: '0.08em' })}>
                  {label}
                </button>
              ))}
            </div>

            <input
              className="mt-4 w-full rounded-xl border border-white/14 px-4 py-4 text-lg text-foreground outline-none focus:border-foreground/40"
              style={{ background: 'rgba(13,13,13,0.9)', ...mono() }}
              placeholder="Scan QR / type name or ref…"
              value={lookup}
              onChange={(e) => { setLookup(e.target.value); setVerdict(null); }}
              autoComplete="off" autoCorrect="off" spellCheck={false}
            />
            {offlineMatches.length > 0 && !verdict ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-white/12">
                {offlineMatches.slice(0, 6).map((v) => (
                  <button key={v.visitId} type="button" onClick={() => { setLookup(v.name); scan(v); }}
                    className="flex w-full items-center justify-between border-t border-white/8 px-4 py-3 text-left first:border-t-0 hover:bg-white/[0.04]">
                    <span className="font-body text-sm font-semibold">{v.name}</span>
                    <span className="text-[10px]" style={mono({ color: v.gfeStatus === 'cleared' ? EVENT_TONES.live : EVENT_TONES.muted, letterSpacing: '0.06em' })}>
                      {(v.serviceClass || 'EXP').toUpperCase()} · {v.gfeStatus.toUpperCase()} · {v.status.toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <VerdictCard verdict={verdict} onCheckin={checkin} busy={busy} />
          </div>
        ) : (
          <div className="mt-5">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} style={mono()} onClick={() => queueAction('call_next', null, { station: 'gfe-1' })}>CALL NEXT</button>
              <button type="button" className={btn} style={mono()} onClick={() => queueAction('call_next', null, { station: 'gfe-1', lane: 'express' })}>CALL NEXT · SHOT LANE</button>
            </div>
            {notice ? <p className="mt-3 text-xs" style={mono({ color: '#F5B85A' })}>{notice.toUpperCase()}</p> : null}
            <div className="mt-4 space-y-2">
              {queue.length === 0 ? (
                <p className="border-t border-white/12 py-4 text-sm text-foreground/50" style={mono()}>QUEUE IS EMPTY</p>
              ) : queue.map((e) => (
                <div key={e.id} className="rounded-xl border border-white/12 p-4" style={{ background: 'rgba(13,13,13,0.9)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm" style={mono({ color: ['called', 'at_station', 'in_gfe'].includes(e.status) ? EVENT_TONES.live : EVENT_TONES.ink, letterSpacing: '0.06em' })}>
                      №{e.position} · {e.display_initials} · {e.lane === 'express' ? 'SHOTS' : 'IV'}
                    </span>
                    <span className="text-[10px] uppercase text-foreground/50" style={mono()}>
                      {e.status.toUpperCase()}{e.station_id ? ` · ${e.station_id.toUpperCase()}` : ''}{e.call_count ? ` · CALLS ${e.call_count}` : ''}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {e.status === 'called' ? (
                      <>
                        <button type="button" className={btn} style={mono()} onClick={() => queueAction('at_station', e.id)}>AT STATION</button>
                        <button type="button" className={btn} style={mono()} onClick={() => queueAction('no_answer', e.id)}>NO ANSWER</button>
                      </>
                    ) : null}
                    {e.status === 'at_station' ? (
                      <button type="button" className={btn} style={mono()} onClick={() => queueAction('in_gfe', e.id)}>START GFE</button>
                    ) : null}
                    {['at_station', 'in_gfe'].includes(e.status) ? (
                      <>
                        <button type="button" className="rounded-full px-4 py-2 text-[11px] font-bold uppercase text-background" style={{ background: EVENT_TONES.live, fontFamily: MONO_STACK }} onClick={() => queueAction('clear', e.id)}>CLEAR</button>
                        <button type="button" className="rounded-full px-4 py-2 text-[11px] font-bold uppercase text-white" style={{ background: EVENT_TONES.stop, fontFamily: MONO_STACK }} onClick={() => queueAction('decline', e.id)}>DECLINE</button>
                      </>
                    ) : null}
                    {e.status === 'left' ? (
                      <button type="button" className={btn} style={mono()} onClick={() => queueAction('rejoin', e.id)}>REJOIN</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
