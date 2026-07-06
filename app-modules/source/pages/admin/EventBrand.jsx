import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/apiClient';
import { EVENT_TONES, MONO_STACK } from '@/lib/eventStatus';
import { useSeo } from '@/lib/seo';

/**
 * /admin/events/:slug/brand — the Brand & Content audit view (amendment J):
 * every asset with uploader + status, one-tap pull/approve (pull reverts the
 * live page instantly), and the curated theme picker. STILL regime: dense,
 * instant, zero animation. All actions audit-logged server-side.
 */

const mono = (extra = {}) => ({ fontFamily: MONO_STACK, ...extra });
const STATUS_COLOR = { live: EVENT_TONES.live, pending: '#F5B85A', pulled: EVENT_TONES.muted };

export default function EventBrand() {
  const { slug = '' } = useParams();
  const [assets, setAssets] = useState([]);
  const [themes, setThemes] = useState([]);
  const [themeId, setThemeId] = useState(null);
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);

  useSeo({ title: 'Brand & Content — Avalon Events', description: 'Event brand audit.', path: `/admin/events/${slug}/brand`, robots: 'noindex,nofollow' });

  const load = useCallback(async () => {
    try {
      const body = await apiGet(`/api/events/assets?slug=${encodeURIComponent(slug)}`);
      if (body.ok) {
        setAssets(body.assets || []);
        setThemes(body.themes || []);
        setThemeId(body.themeId || null);
      }
    } catch (err) { setNotice(err.message || 'Load failed.'); }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function moderate(assetId, status) {
    setNotice('');
    try {
      await apiPost('/api/events/assets', { slug, action: 'moderate', assetId, status });
      await load();
    } catch (err) { setNotice(err.message || 'Action failed.'); }
  }

  async function setTheme(nextId) {
    setNotice('');
    try {
      await apiPost('/api/events/assets', { slug, action: 'set_theme', themeId: nextId });
      setThemeId(nextId);
    } catch (err) { setNotice(err.message || 'Theme change failed.'); }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true); setNotice('');
    try {
      const grant = await apiPost('/api/events/assets', { slug, action: 'upload_url', kind: 'gallery', fileName: file.name });
      if (!grant.ok) throw new Error(grant.error || 'Upload refused.');
      if (file.size > grant.maxBytes) throw new Error('Image too large (12MB max).');
      const up = await fetch(grant.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!up.ok) throw new Error('Upload failed.');
      const fin = await apiPost('/api/events/assets', { slug, action: 'finalize', path: grant.path, kind: 'gallery' });
      if (!fin.ok) throw new Error(fin.error || 'Processing failed.');
      await load();
    } catch (err) { setNotice(err.message || 'Upload failed.'); }
    finally { setUploading(false); }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-6 text-foreground md:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-heading text-4xl uppercase leading-none">Brand & Content · {slug}</h1>
        <p className="mt-1 text-[10px] uppercase text-foreground/45" style={mono({ letterSpacing: '0.1em' })}>
          PROMOTERS COMPOSE · AVALON CURATES · EVERY ACTION AUDIT-LOGGED
        </p>
        {notice ? <p className="mt-3 text-xs" style={mono({ color: '#F5B85A' })}>{notice.toUpperCase()}</p> : null}

        <section className="mt-6">
          <p className="font-body text-xs font-semibold uppercase text-foreground/42">Event theme (live-state accents only — chrome and clinical colors are locked)</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setTheme(null)}
              className={`rounded-full border px-4 py-2.5 text-[11px] uppercase ${!themeId ? 'border-foreground text-foreground' : 'border-white/14 text-foreground/60'}`}
              style={mono({ letterSpacing: '0.06em' })}>
              <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: EVENT_TONES.live }} />
              Avalon default
            </button>
            {themes.map((t) => (
              <button key={t.id} type="button" onClick={() => setTheme(t.id)}
                className={`rounded-full border px-4 py-2.5 text-[11px] uppercase ${themeId === t.id ? 'border-foreground text-foreground' : 'border-white/14 text-foreground/60'}`}
                style={mono({ letterSpacing: '0.06em' })}>
                <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: t.tokens?.live || EVENT_TONES.live }} />
                {t.name}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <p className="font-body text-xs font-semibold uppercase text-foreground/42">Imagery ({assets.length})</p>
            <label className={`cursor-pointer rounded-full border border-white/14 px-4 py-2.5 text-[11px] uppercase text-foreground/80 hover:border-white/30 ${uploading ? 'opacity-50' : ''}`} style={mono()}>
              {uploading ? 'PROCESSING…' : 'UPLOAD'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={onFile} disabled={uploading} />
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {assets.length === 0 ? (
              <p className="border-t border-white/12 py-4 text-sm text-foreground/50" style={mono()}>NO UPLOADS YET</p>
            ) : assets.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-xl border border-white/12" style={{ background: 'rgba(13,13,13,0.9)' }}>
                {a.previewUrl ? (
                  <img src={a.previewUrl} alt="" className="h-40 w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-foreground/40" style={mono()}>NO PREVIEW</div>
                )}
                <div className="p-3">
                  <p className="text-[10px] uppercase" style={mono({ color: STATUS_COLOR[a.status] || EVENT_TONES.muted, letterSpacing: '0.08em' })}>
                    {a.status.toUpperCase()} · {a.kind.toUpperCase()} · {new Date(a.created_at).toLocaleDateString()}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {a.status !== 'live' ? (
                      <button type="button" onClick={() => moderate(a.id, 'live')}
                        className="rounded-full px-3 py-1.5 text-[10px] font-bold uppercase text-background" style={{ background: EVENT_TONES.live, fontFamily: MONO_STACK }}>
                        Approve
                      </button>
                    ) : null}
                    {a.status !== 'pulled' ? (
                      <button type="button" onClick={() => moderate(a.id, 'pulled')}
                        className="rounded-full border border-white/14 px-3 py-1.5 text-[10px] uppercase text-foreground/70" style={mono()}>
                        Pull
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
