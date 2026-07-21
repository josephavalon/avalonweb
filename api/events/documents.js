/**
 * Event operations document pipeline. COIs, floor plans, and venue requirement
 * files only — never attendee data, charts, health forms, or clinical records.
 */
import { getServiceClient, getAuthedUser, requireStaff } from '../_lib/supabase-auth.js';
import { checkRateLimit, clientIp } from '../_lib/rate-limit.js';

const BUCKET = 'event-documents';
const MAX_BYTES = 20 * 1024 * 1024;
const KINDS = new Set(['coi', 'floor_plan', 'venue_photo', 'venue_requirements', 'other']);
const EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);

async function callerForEvent(req, res, db, container) {
  const auth = await getAuthedUser(req);
  if (!auth?.user) { res.status(401).json({ ok: false, error: 'Sign in required.' }); return null; }
  const role = auth.role || auth.profile?.role || 'client';
  if (['ops_manager', 'staff', 'admin', 'founder'].includes(role)) return { ...auth, isStaff: true };
  const { data } = await db.from('event_promoters').select('id')
    .eq('container_id', container.id).eq('profile_id', auth.user.id).maybeSingle();
  if (data) return { ...auth, isStaff: false };
  res.status(403).json({ ok: false, error: 'Not allowed for this event.' });
  return null;
}

function isExpectedFile(buffer, extension) {
  if (extension === 'pdf') return buffer.subarray(0, 4).toString() === '%PDF';
  if (extension === 'png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export default async function handler(req, res) {
  const limit = await checkRateLimit({ key: `event-documents:${clientIp(req)}`, windowMs: 60_000, max: 40 });
  if (!limit.ok) return res.status(429).json({ ok: false, error: 'Too many document requests. Try again shortly.' });
  const db = await getServiceClient();
  if (!db) return res.status(500).json({ ok: false, error: 'Service unavailable.' });
  const params = req.method === 'GET' ? req.query : (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {});
  const slug = String(params.slug || '').trim();
  const { data: container } = await db.from('event_containers').select('id, tenant_id, slug').eq('slug', slug).maybeSingle();
  if (!container) return res.status(404).json({ ok: false, error: 'Event not found.' });

  try {
    if (req.method === 'GET') {
      const caller = await callerForEvent(req, res, db, container);
      if (!caller) return undefined;
      const { data } = await db.from('event_documents').select('*').eq('container_id', container.id).order('created_at', { ascending: false });
      const documents = [];
      for (const document of data || []) {
        const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(document.storage_path, 3600);
        documents.push({ ...document, url: signed?.signedUrl || null });
      }
      return res.status(200).json({ ok: true, documents });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
    const action = String(params.action || '');

    if (action === 'upload_url') {
      const caller = await callerForEvent(req, res, db, container);
      if (!caller) return undefined;
      const kind = KINDS.has(params.kind) ? params.kind : null;
      const extension = String(params.fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
      if (!kind || !EXTENSIONS.has(extension) || (kind === 'venue_photo' && extension === 'pdf')) return res.status(400).json({ ok: false, error: kind === 'venue_photo' ? 'Upload a JPG or PNG venue photo.' : 'Upload a PDF, JPG, or PNG operations document.' });
      const path = `${container.id}/${kind}/${crypto.randomUUID()}.${extension}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return res.status(200).json({ ok: true, path, uploadUrl: data.signedUrl, maxBytes: MAX_BYTES });
    }

    if (action === 'finalize') {
      const caller = await callerForEvent(req, res, db, container);
      if (!caller) return undefined;
      const kind = KINDS.has(params.kind) ? params.kind : null;
      const path = String(params.path || '');
      const extension = path.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
      if (!kind || !path.startsWith(`${container.id}/${kind}/`) || !EXTENSIONS.has(extension)) return res.status(400).json({ ok: false, error: 'Bad document path.' });
      const { data: blob, error: downloadError } = await db.storage.from(BUCKET).download(path);
      if (downloadError || !blob) return res.status(400).json({ ok: false, error: 'Upload not found — try again.' });
      const buffer = Buffer.from(await blob.arrayBuffer());
      if (buffer.length > MAX_BYTES || !isExpectedFile(buffer, extension)) {
        await db.storage.from(BUCKET).remove([path]);
        return res.status(400).json({ ok: false, error: buffer.length > MAX_BYTES ? 'Document is larger than 20 MB.' : 'The file content does not match its extension.' });
      }
      const contentType = extension === 'pdf' ? 'application/pdf' : extension === 'png' ? 'image/png' : 'image/jpeg';
      const fileName = String(params.fileName || `${kind}.${extension}`).replace(/[^a-zA-Z0-9._ -]/g, '').slice(0, 180);
      const { data: document, error } = await db.from('event_documents').insert({
        tenant_id: container.tenant_id, container_id: container.id, kind, file_name: fileName,
        content_type: contentType, size_bytes: buffer.length, storage_path: path,
        uploaded_by: caller.user.id, status: caller.isStaff ? 'approved' : 'pending',
      }).select().single();
      if (error) throw error;
      await db.from('event_audit_log').insert({
        tenant_id: container.tenant_id, actor: caller.user.id, action: 'event_document_upload',
        target_type: 'event_document', target_id: document.id, meta: { container_id: container.id, kind },
      });
      return res.status(200).json({ ok: true, document });
    }

    if (action === 'moderate') {
      const caller = await requireStaff(req, res);
      if (!caller) return undefined;
      const status = ['approved', 'rejected', 'superseded', 'pending'].includes(params.status) ? params.status : null;
      if (!status) return res.status(400).json({ ok: false, error: 'Bad status.' });
      const { data: document, error } = await db.from('event_documents').update({ status, reviewed_by: caller.user.id, reviewed_at: new Date().toISOString() }).eq('id', params.documentId).eq('container_id', container.id).select().single();
      if (error) throw error;
      return res.status(200).json({ ok: true, document });
    }
    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (error) {
    console.error('[events/documents]', error?.message || error);
    return res.status(500).json({ ok: false, error: 'Document action failed.' });
  }
}
