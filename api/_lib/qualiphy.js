/**
 * Qualiphy API client — telehealth Good Faith Exam (GFE) provider.
 *
 * Base: https://api.qualiphy.me/api/   Auth: `api_key` in the JSON body (server
 * only — never client). On `exam_invite` Qualiphy assigns a provider, runs the
 * telehealth exam, and POSTs the result to our `webhook_url` (Event 1:
 * exam_status Approved/Rejected/Deferred/NA/Missed + a PDF link).
 *
 * Env:
 *   QUALIPHY_API_KEY   clinic API key (Default Clinic)
 *
 * Returns { ok: true, ... } or { ok:false, code, status }. Never throws.
 */
import { safeLogContext } from './safe-error.js';

const BASE = 'https://api.qualiphy.me/api';

export function isQualiphyConfigured() {
  return Boolean(process.env.QUALIPHY_API_KEY);
}

async function qualiphyPost(path, payload, timeoutMs = 15000) {
  const apiKey = process.env.QUALIPHY_API_KEY;
  if (!apiKey) return { ok: false, code: 'qualiphy_not_configured', status: 503 };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, ...payload }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!res.ok) {
      console.warn(`[qualiphy] ${path} failed`, { status: res.status, body: String(text).slice(0, 300) });
      return { ok: false, code: 'qualiphy_request_failed', status: res.status, data };
    }
    return { ok: true, data };
  } catch (err) {
    console.warn(`[qualiphy] ${path} error`, safeLogContext(err, 'qualiphy_request_error'));
    return { ok: false, code: 'qualiphy_request_error', status: 502 };
  }
}

/** List the clinic's exam types + ids (used to resolve the GFE exam id). */
export function listExams() {
  return qualiphyPost('/exam_list', {});
}

/**
 * Create a GFE exam invite. Qualiphy assigns a provider + emails the patient the
 * meeting link, then webhooks the result to `webhookUrl`.
 * @returns on ok: { data: { meeting_url, meeting_uuid, patient_exams:[{patient_exam_id}] } }
 */
export function createExamInvite({ exams, firstName, lastName, email, dob, phone, teleState, webhookUrl }) {
  return qualiphyPost('/exam_invite', {
    exams,                       // array of exam ids, e.g. [4106]
    first_name: firstName,
    last_name: lastName,
    email,
    dob,                         // YYYY-MM-DD
    phone_number: phone,
    tele_state: teleState,       // 2-letter, e.g. 'CA'
    ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
  });
}
