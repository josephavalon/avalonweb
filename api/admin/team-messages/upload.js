/**
 * POST /api/admin/team-messages/upload
 *
 * Internal team inbox: upload an image attachment. Accepts a base64 data URL
 * (the way every other JSON endpoint in this repo takes bodies — there is no
 * shared multipart/storage helper). The image is stored in the private
 * Supabase Storage bucket `team-inbox` (created by migration 021) via the
 * service-role client, scoped under <tenantId>/<uuid>.<ext>. Returns a long-lived
 * signed URL the inbox can render and persist on the message's attachments[].
 *
 * Body: { dataUrl: "data:image/png;base64,....", name?: string }
 * Returns: { url, name, type }
 *
 * Service-role + requireStaff; tenant-scoped. Image-only; capped at 10 MB.
 */
import { requireStaff } from '../../_lib/supabase-auth.js';
import { resolveActor } from '../../_lib/team-inbox-store.js';
import { safeErrorCode, safeLogContext } from '../../_lib/safe-error.js';

const BUCKET = 'team-inbox';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const SIGNED_URL_TTL = 60 * 60 * 24 * 365; // 1 year

// Raise the body limit so a ~10 MB image (≈13.4 MB as base64) fits.
export const config = { api: { bodyParser: { sizeLimit: '15mb' } } };

const EXT_BY_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/** Parse a data URL into { type, buffer }, or null if it isn't a valid image one. */
function parseImageDataUrl(dataUrl) {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(String(dataUrl || '').trim());
  if (!m) return null;
  const type = m[1].toLowerCase();
  if (!type.startsWith('image/')) return null;
  if (!EXT_BY_TYPE[type]) return null;
  let buffer;
  try {
    buffer = Buffer.from(m[2], 'base64');
  } catch {
    return null;
  }
  if (!buffer.length) return null;
  return { type, buffer };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authed = await requireStaff(req, res);
  if (!authed) return;

  const dataUrl = req.body?.dataUrl;
  const rawName = String(req.body?.name || '').trim();

  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) {
    return res.status(400).json({ error: 'Attach a valid image (PNG, JPEG, GIF, WEBP, HEIC).', code: 'invalid_image' });
  }
  if (parsed.buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: 'Image is too large (max 10 MB).', code: 'image_too_large' });
  }

  try {
    const actor = await resolveActor(req);
    if (!actor) return res.status(403).json({ error: 'Insufficient access', code: 'no_actor' });

    const ext = EXT_BY_TYPE[parsed.type];
    const uuid = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const path = `${actor.tenantId}/${uuid}.${ext}`;
    const name = (rawName || `image.${ext}`).slice(0, 200);

    const { error: upErr } = await actor.db.storage
      .from(BUCKET)
      .upload(path, parsed.buffer, { contentType: parsed.type, upsert: false });
    if (upErr) {
      console.warn('[team-messages/upload] storage upload failed', safeLogContext(upErr, 'team_upload_storage'));
      return res.status(500).json({ error: 'Could not store the image.', code: 'upload_failed' });
    }

    const { data: signed, error: signErr } = await actor.db.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) {
      console.warn('[team-messages/upload] sign failed', safeLogContext(signErr, 'team_upload_sign'));
      return res.status(500).json({ error: 'Could not store the image.', code: 'upload_failed' });
    }

    return res.status(200).json({ url: signed.signedUrl, name, type: parsed.type });
  } catch (err) {
    console.warn('[team-messages/upload] failed', safeLogContext(err, 'team_upload_failed'));
    return res.status(500).json({ error: 'Could not upload the image.', code: safeErrorCode(err, 'team_upload_failed') });
  }
}
