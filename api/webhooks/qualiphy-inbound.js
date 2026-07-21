/**
 * POST /api/webhooks/qualiphy-inbound?secret=...
 *
 * Qualiphy posts the GFE exam result here (Event 1 — Consultation Complete).
 * Secret-gated via the query string (set QUALIPHY_WEBHOOK_SECRET and include it
 * in the webhook_url passed on exam_invite). On Approved we:
 *   1. find our appointment by the stored patient_exam_id,
 *   2. cache the GFE on the patient profile (powers fast checkout), and
 *   3. write the GFE into the Acuity appointment (source of record).
 */
import { getServiceClient } from '../_lib/supabase-auth.js';
import { writeGfeToAcuity, deriveExpiry } from '../_lib/gfe-core.js';
import { safeLogContext } from '../_lib/safe-error.js';

function pick(obj, ...keys) {
  for (const k of keys) if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  return undefined;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const expected = process.env.QUALIPHY_WEBHOOK_SECRET;
  if (!expected) return res.status(503).json({ error: 'Webhook not configured' });
  const provided = String(req.query?.secret || req.headers['x-webhook-secret'] || '');
  if (provided !== expected) return res.status(401).json({ error: 'Unauthorized' });

  const body = req.body || {};
  const event = Number(pick(body, 'event'));
  // We only act on Event 1 (consultation complete). Ack the rest so Qualiphy
  // doesn't retry.
  if (event && event !== 1) return res.status(200).json({ ok: true, ignored: `event_${event}` });

  const patientExamId = String(pick(body, 'patient_exam_id', 'patientExamId') || '');
  const examStatus = String(pick(body, 'exam_status', 'examStatus', 'status') || '');
  const pdfUrl = pick(body, 'exam_url', 'examUrl', 'pdf', 'pdf_url') || null;
  const provider = pick(body, 'provider_name', 'providerName', 'provider') || null;
  if (!patientExamId) return res.status(200).json({ ok: true, ignored: 'no_patient_exam_id' });

  const approved = /approv/i.test(examStatus);
  const db = await getServiceClient();
  if (!db) return res.status(200).json({ ok: true, queued: false, note: 'db_not_configured' });

  try {
    // 1. Locate the appointment we stamped at exam_invite time.
    const { data: rows } = await db.from('appointments')
      .select('id, tenant_id, acuity_appointment_id, external_payload')
      .contains('external_payload', { gfe: { patientExamId } })
      .limit(1);
    let appt = rows?.[0];
    if (!appt) {
      // Fallback: scan recent appointments whose gfe.patientExamId matches.
      const { data: recent } = await db.from('appointments')
        .select('id, tenant_id, acuity_appointment_id, external_payload')
        .order('created_at', { ascending: false }).limit(200);
      appt = (recent || []).find((r) => String(r.external_payload?.gfe?.patientExamId || '') === patientExamId);
    }

    const clearedAt = new Date().toISOString();
    const gfeRecord = {
      status: approved ? 'approved' : examStatus.toLowerCase(),
      clearedAt,
      expiresAt: approved ? deriveExpiry(clearedAt) : null,
      provider: provider || null,
      pdfUrl: pdfUrl || null,
      source: 'qualiphy',
      patientExamId,
    };

    if (appt) {
      const payload = appt.external_payload || {};
      const email = (payload.contact?.email || '').trim().toLowerCase();
      await db.from('appointments').update({
        gfe_status: approved ? 'approved' : 'denied',
        external_payload: { ...payload, gfe: { ...(payload.gfe || {}), ...gfeRecord } },
        updated_at: clearedAt,
      }).eq('id', appt.id);

      // 2. Cache on the patient profile (fast checkout).
      if (approved && email) {
        await db.from('profiles').update({ gfe: gfeRecord }).eq('email', email);
      }

      // 3. Write into the Acuity appointment (source of record).
      if (approved && appt.acuity_appointment_id) {
        const w = await writeGfeToAcuity(appt.acuity_appointment_id, {
          status: 'Approved', date: clearedAt.slice(0, 10), provider, expiry: gfeRecord.expiresAt?.slice(0, 10), pdf: pdfUrl,
        });
        if (!w.ok) console.warn('[qualiphy/webhook] acuity write skipped', w);
      }
    } else {
      console.warn('[qualiphy/webhook] no appointment matched patient_exam_id', { patientExamId });
    }

    return res.status(200).json({ ok: true, matched: !!appt, approved });
  } catch (err) {
    console.warn('[qualiphy/webhook] error', safeLogContext(err, 'qualiphy_webhook_error'));
    return res.status(200).json({ ok: false });
  }
}
