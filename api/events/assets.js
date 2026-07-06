/**
 * Organizer imagery pipeline (ET7, amendment J + T8). Staff + event promoters.
 *
 *   POST /api/events/assets { slug, action: 'upload_url', kind, fileName }
 *        → short-lived signed upload URL into the PRIVATE event-assets bucket
 *   POST /api/events/assets { slug, action: 'finalize', path, kind }
 *        → sharp pipeline: EXIF stripped (sharp drops metadata by default),
 *          fixed renditions (hero_1920 / card_640 / thumb_320 webp), asset row
 *          status 'pending' (default-pending moderation for promoters; staff
 *          uploads go live immediately)
 *   POST /api/events/assets { slug, action: 'moderate', assetId, status }
 *        → operator one-tap live/pulled (pull reverts the live page instantly)
 *   POST /api/events/assets { slug, action: 'set_theme', themeId }
 *        → curated theme picker (live-state accents only; chrome is locked)
 *   GET  /api/events/assets?slug=  → assets + themes for the brand audit view
 *
 * Size/type guards enforce the TTF page-weight budget at the door.
 */
import { getServiceClient, getAuthedUser, requireStaff } from '../_lib/supabase-auth.js';

const BUCKET = 'event-assets';
const MAX_BYTES = 12 * 1024 * 1024;
const RENDITIONS = [
  ['hero_1920', 1920],
  ['card_640', 640],
  ['thumb_320', 320],
];

async function callerForEvent(req, res, db, container) {
  // Staff pass outright; promoters pass only for THEIR event.
  const auth = await getAuthedUser(req);
  if (!auth?.user) {
    res.status(401).json({ ok: false, error: 'Sign in required.' });
    return null;
  }
  const role = auth.profile?.role || 'client';
  const staffRoles = ['ops_manager', 'staff', 'admin', 'founder', 'nurse', 'rn', 'np', 'physician', 'medical_director'];
  if (staffRoles.includes(role)) return { ...auth, isStaff: true };
  if (role === 'promoter') {
    const { data } = await db.from('event_promoters')
      .select('id').eq('container_id', container.id).eq('profile_id', auth.user.id).maybeSingle();
    if (data) return { ...auth, isStaff: false };
  }
  res.status(403).json({ ok: false, error: 'Not allowed for this event.' });
  return null;
}

export default async function handler(req, res) {
  const db = await getServiceClient();
  if (!db) return res.status(500).json({ ok: false, error: 'Service unavailable.' });

  const params = req.method === 'GET' ? req.query : (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {});
  const slug = String(params.slug || '').trim();
  const { data: container } = await db
    .from('event_containers')
    .select('id, tenant_id, slug, theme_id')
    .eq('slug', slug)
    .maybeSingle();
  if (!container) return res.status(404).json({ ok: false, error: 'Event not found.' });

  try {
    if (req.method === 'GET') {
      const caller = await callerForEvent(req, res, db, container);
      if (!caller) return undefined;
      const [{ data: assets }, { data: themes }] = await Promise.all([
        db.from('event_assets').select('*').eq('container_id', container.id).order('created_at', { ascending: false }),
        db.from('event_themes').select('id, name, tokens, active').eq('active', true),
      ]);
      // Signed preview URLs for the audit view (1h).
      const shaped = [];
      for (const a of assets || []) {
        let previewUrl = null;
        const path = a.renditions?.card_640 || a.storage_path;
        if (path) {
          const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(path, 3600);
          previewUrl = signed?.signedUrl || null;
        }
        shaped.push({ ...a, previewUrl });
      }
      return res.status(200).json({ ok: true, assets: shaped, themes: themes || [], themeId: container.theme_id });
    }

    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const action = String(params.action || '');

    if (action === 'upload_url') {
      const caller = await callerForEvent(req, res, db, container);
      if (!caller) return undefined;
      const ext = String(params.fileName || '').toLowerCase().match(/\.(jpe?g|png|webp|heic)$/)?.[1];
      if (!ext) return res.status(400).json({ ok: false, error: 'JPEG, PNG, WEBP, or HEIC only.' });
      const path = `${container.id}/originals/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return res.status(200).json({ ok: true, path, uploadUrl: data.signedUrl, token: data.token, maxBytes: MAX_BYTES });
    }

    if (action === 'finalize') {
      const caller = await callerForEvent(req, res, db, container);
      if (!caller) return undefined;
      const path = String(params.path || '');
      if (!path.startsWith(`${container.id}/originals/`)) {
        return res.status(400).json({ ok: false, error: 'Bad asset path.' });
      }
      const { data: blob, error: dlErr } = await db.storage.from(BUCKET).download(path);
      if (dlErr || !blob) return res.status(400).json({ ok: false, error: 'Upload not found — try again.' });
      const buf = Buffer.from(await blob.arrayBuffer());
      if (buf.length > MAX_BYTES) {
        await db.storage.from(BUCKET).remove([path]);
        return res.status(400).json({ ok: false, error: 'Image too large (12MB max).' });
      }

      // sharp strips EXIF/GPS by default (no .withMetadata()) — T8.
      const { default: sharp } = await import('sharp');
      const renditions = {};
      for (const [key, width] of RENDITIONS) {
        const out = await sharp(buf).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
        const rPath = `${container.id}/renditions/${key}-${crypto.randomUUID()}.webp`;
        const { error: upErr } = await db.storage.from(BUCKET).upload(rPath, out, { contentType: 'image/webp' });
        if (upErr) throw upErr;
        renditions[key] = rPath;
      }

      const { data: asset, error } = await db.from('event_assets').insert({
        tenant_id: container.tenant_id,
        container_id: container.id,
        kind: params.kind === 'hero' ? 'hero' : 'gallery',
        storage_path: path,
        renditions,
        uploaded_by: caller.user.id,
        status: caller.isStaff ? 'live' : 'pending',   // default-pending moderation for promoters
      }).select().single();
      if (error) throw error;
      return res.status(200).json({ ok: true, asset });
    }

    if (action === 'moderate') {
      const caller = await requireStaff(req, res);
      if (!caller) return undefined;
      const status = ['live', 'pulled', 'pending'].includes(params.status) ? params.status : null;
      if (!status) return res.status(400).json({ ok: false, error: 'Bad status.' });
      const { data: asset, error } = await db.from('event_assets')
        .update({ status, reviewed_by: caller.user?.id || null, reviewed_at: new Date().toISOString() })
        .eq('id', params.assetId).eq('container_id', container.id)
        .select().single();
      if (error) throw error;
      await db.from('event_audit_log').insert({
        tenant_id: container.tenant_id, actor: caller.user?.id || null,
        action: 'asset_moderate', target_type: 'event_asset', target_id: asset.id,
        to_value: status, meta: { container_id: container.id },
      });
      return res.status(200).json({ ok: true, asset });
    }

    if (action === 'set_theme') {
      const caller = await requireStaff(req, res);
      if (!caller) return undefined;
      const themeId = params.themeId || null;
      if (themeId) {
        const { data: theme } = await db.from('event_themes').select('id').eq('id', themeId).eq('active', true).maybeSingle();
        if (!theme) return res.status(400).json({ ok: false, error: 'Unknown theme.' });
      }
      const { error } = await db.from('event_containers').update({ theme_id: themeId }).eq('id', container.id);
      if (error) throw error;
      await db.from('event_audit_log').insert({
        tenant_id: container.tenant_id, actor: caller.user?.id || null,
        action: 'theme_set', target_type: 'event_container', target_id: container.id,
        from_value: container.theme_id || null, to_value: themeId,
      });
      return res.status(200).json({ ok: true, themeId });
    }

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('[events/assets]', err?.message || err);
    return res.status(500).json({ ok: false, error: 'Asset action failed.' });
  }
}
