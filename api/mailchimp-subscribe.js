/**
 * POST /api/mailchimp-subscribe
 * Body: { email, firstName?, source? }
 * Adds an email to the Mailchimp audience. Webstore lead capture.
 * Env: MAILCHIMP_API_KEY (required), MAILCHIMP_AUDIENCE_ID (optional — auto-resolves
 * to the first audience if unset), MAILCHIMP_SERVER_PREFIX (optional — derived from key).
 * Intentionally NOT gated by AVALON_ENABLE_LIVE_API so we capture leads during beta.
 */

function serverPrefixFromKey(key = '') {
  const fromKey = key.split('-')[1]; // Mailchimp keys end with "-usXX"
  return process.env.MAILCHIMP_SERVER_PREFIX || fromKey || '';
}

async function mc(path, { method = 'GET', body, apiKey, dc } = {}) {
  const resp = await fetch(`https://${dc}.api.mailchimp.com/3.0${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, json };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, code: 'mailchimp_not_configured' });

  const { email, firstName = '', source = 'webstore' } = req.body || {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
    return res.status(400).json({ ok: false, error: 'Valid email required' });
  }

  const dc = serverPrefixFromKey(apiKey);
  if (!dc) return res.status(503).json({ ok: false, code: 'mailchimp_dc_unresolved' });

  try {
    let audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
    if (!audienceId) {
      const lists = await mc('/lists?count=1&fields=lists.id', { apiKey, dc });
      audienceId = lists.json?.lists?.[0]?.id;
      if (!audienceId) return res.status(503).json({ ok: false, code: 'no_audience' });
    }

    const add = await mc(`/lists/${audienceId}/members`, {
      method: 'POST',
      apiKey,
      dc,
      body: {
        email_address: String(email).trim(),
        status: 'subscribed',
        merge_fields: firstName ? { FNAME: firstName } : undefined,
        tags: [source],
      },
    });

    if (add.status >= 200 && add.status < 300) return res.status(200).json({ ok: true });
    if (add.json?.title === 'Member Exists') return res.status(200).json({ ok: true, existing: true });

    console.warn('[mailchimp-subscribe]', add.status, add.json?.title);
    return res.status(add.status || 502).json({ ok: false, code: add.json?.title || 'mailchimp_error' });
  } catch (err) {
    console.error('[mailchimp-subscribe]', err.message);
    return res.status(502).json({ ok: false, code: 'mailchimp_request_failed' });
  }
}
