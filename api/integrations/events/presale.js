/**
 * POST /api/integrations/events/presale
 *
 * Partner-facing presale ingress. Accepts a ticket/code sold outside Avalon and
 * returns the Avalon redemption link. If an internal schedule slot is supplied,
 * it can also create the scheduling handoff.
 */

import { acuityFetch } from '../../_acuity.js';
import { isLiveApiEnabled } from '../../_lib/pre-api-guard.js';
import { safeLogContext } from '../../_lib/safe-error.js';

// PUBLIC_SITE_URL is the only trusted host source. Trusting X-Forwarded-Host
// would let a partner caller (the only authenticated source for this route)
// rewrite the redemption-link host and harvest the codes.
function siteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'https://avalonvitality.co').replace(/\/$/, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const liveApi = isLiveApiEnabled();
  const secret = process.env.EVENT_PRESALE_WEBHOOK_SECRET;
  if (liveApi && !secret) {
    return res.status(503).json({ error: 'Event presale webhook secret is not configured', code: 'event_presale_secret_missing' });
  }
  if (secret) {
    const header = req.headers.authorization || '';
    if (header !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    eventId = 'event-partner',
    eventName = 'Partner Event Presale',
    code,
    ticketId,
    source = 'Partner ticket',
    firstName,
    lastName = '',
    email,
    phone = '',
    selectedTime = '',
    appointmentTypeID,
    datetime,
    notes = '',
    fields = [],
    gfeRequired = true,
  } = req.body || {};

  const redemptionCode = String(code || ticketId || '').trim().toUpperCase();
  if (!redemptionCode || !email) {
    return res.status(400).json({ error: 'code or ticketId, plus email, are required' });
  }

  const redemptionLink = `${siteUrl()}/presale/${encodeURIComponent(eventId)}?code=${encodeURIComponent(redemptionCode)}&source=${encodeURIComponent(source)}`;
  const response = {
    ok: true,
    eventId,
    eventName,
    code: redemptionCode,
    source,
    selectedTime,
    redemptionLink,
    scheduleStatus: datetime && appointmentTypeID ? 'creating' : 'redemption_required',
    gfeStatus: gfeRequired ? 'pre_event_gfe_required' : 'not_required',
  };

  if (appointmentTypeID && datetime && firstName && email) {
    if (!liveApi) {
      response.scheduleStatus = 'local_presale_queued';
      response.scheduleId = `local-presale-${redemptionCode}`;
      response.preApiHardWall = true;
      response.provider = 'local-simulation';
      return res.status(200).json(response);
    }

    try {
      const appointment = await acuityFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          appointmentTypeID,
          datetime,
          firstName,
          lastName,
          email,
          phone,
          notes: [
            `Event presale: ${eventName}`,
            `Presale code: ${redemptionCode}`,
            `Source: ${source}`,
            gfeRequired ? 'GFE: required before event service' : 'GFE: not required by event config',
            selectedTime ? `Event time preference: ${selectedTime}` : '',
            notes,
          ].filter(Boolean).join('\n'),
          fields,
        }),
      });
      response.scheduleStatus = 'created';
      response.scheduleId = appointment?.id;
    } catch (err) {
      console.error('[event-presale]', safeLogContext(err, 'event_presale_schedule_failed'));
      response.scheduleStatus = 'needs_manual_review';
      response.scheduleError = 'schedule_creation_failed';
      return res.status(202).json(response);
    }
  }

  return res.status(200).json(response);
}
