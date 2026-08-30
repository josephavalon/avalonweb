import crypto from 'crypto';
import { writeAuditEvent } from './audit-events.js';
import { safeErrorCode, safeLogContext } from './safe-error.js';
import { CADENCE_DAYS, approvalEvidenceSnapshot, draftHashFor } from './robbot3k-atlas.js';
import { recordRobBotCrmOutcome } from './bd-crm-core.js';
import { pacificClock } from './robbot3k-core.js';

const MAX_SEND_ATTEMPTS = 3;

/**
 * Deliberately unconfigured. Resend is not used for cold/scraped outreach.
 * A future provider adapter must be separately implemented and compliance-
 * reviewed before this object can report configured=true.
 */
export const outreachProvider = Object.freeze({
  id: 'unconfigured',
  configured: false,
  supportsIdempotency: false,
  async send() {
    throw Object.assign(new Error('No compliant outreach provider is configured.'), {
      code: 'outreach_provider_not_configured',
    });
  },
  async reconcile() {
    throw Object.assign(new Error('No compliant outreach provider is configured.'), {
      code: 'outreach_provider_not_configured',
    });
  },
});

function requireData(result) {
  if (result?.error) throw result.error;
  return result?.data;
}

function normalizedEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(email) ? email : '';
}

function normalizedSetting(value, { email = false, lower = false } = {}) {
  const normalized = email ? normalizedEmail(value) : String(value || '').trim();
  return lower ? normalized.toLowerCase() : normalized;
}

export function approvalSenderSettingsSnapshot(settings = {}) {
  return {
    senderDisplayName: normalizedSetting(settings.sender_display_name ?? settings.senderDisplayName ?? settings.displayName),
    fromEmail: normalizedSetting(settings.from_email ?? settings.fromEmail, { email: true }),
    replyToEmail: normalizedSetting(settings.reply_to_email ?? settings.replyToEmail, { email: true }),
    calendlyUrl: normalizedSetting(settings.calendly_url ?? settings.calendlyUrl),
    physicalPostalAddress: normalizedSetting(settings.physical_postal_address ?? settings.physicalPostalAddress ?? settings.postalAddress),
    providerSelection: normalizedSetting(settings.provider_selection ?? settings.providerSelection, { lower: true }),
    providerStatus: normalizedSetting(settings.provider_status ?? settings.providerStatus, { lower: true }),
  };
}

export function senderSettingsMatchApproval(approval = {}, settings = {}) {
  const approved = approval.approved_sender_settings ?? approval.approvedSenderSettings;
  if (!approved || typeof approved !== 'object' || Array.isArray(approved) || Object.keys(approved).length === 0) return false;
  return JSON.stringify(approvalSenderSettingsSnapshot(approved)) === JSON.stringify(approvalSenderSettingsSnapshot(settings));
}

export function pacificSendWindow(now = new Date()) {
  const clock = pacificClock(now);
  const weekdayOpen = clock.weekday >= 1 && clock.weekday <= 5;
  const hourOpen = clock.hour >= 9 && clock.hour < 17;
  return {
    open: weekdayOpen && hourOpen,
    reason: !weekdayOpen ? 'outside_send_weekday' : !hourOpen ? 'outside_send_window' : null,
    startHour: 9,
    endHour: 17,
    ...clock,
  };
}

export function outreachExecutionControl(settings = {}, now = new Date()) {
  const globalPause = settings.global_pause ?? settings.globalPause ?? true;
  if (globalPause !== false) {
    return { allowed: false, reason: 'global_pause', window: pacificSendWindow(now) };
  }
  const window = pacificSendWindow(now);
  return { allowed: window.open, reason: window.reason, window };
}

export function shouldEnforceOutreachControls({ live = false, triggerSource = 'manual' } = {}) {
  return live === true || triggerSource === 'schedule';
}

function liveRequested() {
  return ['true', '1', 'yes'].includes(String(process.env.ROBBOT3K_LIVE_SEND_ENABLED || '').trim().toLowerCase());
}

export function initialApprovalExpired(approval, sequence, now = new Date()) {
  return Number(sequence?.sent_count || 0) === 0
    && Boolean(approval?.expires_at)
    && new Date(approval.expires_at).getTime() <= now.getTime();
}

export function senderSettingsReady(settings = {}, providerId = '') {
  return Boolean(
    settings.from_email
    && settings.reply_to_email
    && settings.calendly_url
    && settings.physical_postal_address
    && settings.provider_selection === providerId
    && settings.provider_status === 'connected'
  );
}

function canonicalText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function approvedBodiesContainPostalAddress(steps = [], physicalPostalAddress = '') {
  const address = canonicalText(physicalPostalAddress);
  return Boolean(
    address
    && Array.isArray(steps)
    && steps.length === 4
    && steps.every((step) => canonicalText(step?.body).includes(address))
  );
}

export function failedMessageRetryState(message = {}, now = new Date()) {
  const attempts = Math.max(0, Number(message.attempt_count || 0));
  if (message.status === 'sending') {
    const leaseStart = new Date(message.last_attempt_at || message.created_at || 0);
    const leaseExpired = !Number.isNaN(leaseStart.getTime()) && leaseStart.getTime() + 30 * 60_000 <= now.getTime();
    if (!leaseExpired) return { retry: false, exhausted: false, reason: 'sending_lease_active', attempts };
    if (attempts >= MAX_SEND_ATTEMPTS) return { retry: false, exhausted: true, reason: 'send_retry_exhausted', attempts };
    return { retry: true, exhausted: false, reason: 'sending_lease_expired', attempts, requiresReconciliation: true };
  }
  if (message.status !== 'failed') return { retry: false, exhausted: false, reason: 'message_not_failed', attempts };
  if (attempts >= MAX_SEND_ATTEMPTS) return { retry: false, exhausted: true, reason: 'send_retry_exhausted', attempts };
  const retryAt = message.next_retry_at ? new Date(message.next_retry_at) : null;
  if (retryAt && !Number.isNaN(retryAt.getTime()) && retryAt.getTime() > now.getTime()) {
    return { retry: false, exhausted: false, reason: 'send_retry_backoff', attempts, retryAt: retryAt.toISOString() };
  }
  return { retry: true, exhausted: false, reason: 'send_retry_ready', attempts, requiresReconciliation: true };
}

function retryDelayMs(attemptCount) {
  return Math.min(15 * 60_000 * (4 ** Math.max(0, Number(attemptCount || 1) - 1)), 4 * 60 * 60_000);
}

function sameJson(a, b) {
  return JSON.stringify(a || []) === JSON.stringify(b || []);
}

function addDays(iso, days) {
  return new Date(new Date(iso).getTime() + Number(days) * 86_400_000).toISOString();
}

async function stopSequence(db, sequence, status, reason) {
  const result = await db.from('robbot3k_sequences').update({ status, stop_reason: reason })
    .eq('id', sequence.id).eq('tenant_id', sequence.tenant_id);
  if (result.error) throw result.error;
}

async function gateSequence(db, sequence, now = new Date(), { enforceSendControls = false } = {}) {
  const [prospectResult, approvalResult, replyResult, meetingResult, sentResult, settingsResult] = await Promise.all([
    db.from('robbot3k_prospects').select('*').eq('id', sequence.prospect_id).eq('tenant_id', sequence.tenant_id).maybeSingle(),
    db.from('robbot3k_approvals').select('*').eq('id', sequence.approval_id).eq('tenant_id', sequence.tenant_id).maybeSingle(),
    db.from('robbot3k_messages').select('id').eq('tenant_id', sequence.tenant_id).eq('prospect_id', sequence.prospect_id).eq('direction', 'inbound').limit(1),
    db.from('robbot3k_meetings').select('id').eq('tenant_id', sequence.tenant_id).eq('prospect_id', sequence.prospect_id).in('status', ['scheduled', 'completed']).limit(1),
    db.from('robbot3k_messages').select('id,status,step_index,attempt_count,last_attempt_at,next_retry_at,idempotency_key,provider_message_id,created_at').eq('tenant_id', sequence.tenant_id).eq('sequence_id', sequence.id).eq('direction', 'outbound'),
    db.from('robbot3k_settings').select('*').eq('tenant_id', sequence.tenant_id).maybeSingle(),
  ]);
  const prospect = requireData(prospectResult);
  const approval = requireData(approvalResult);
  const replies = requireData(replyResult) || [];
  const meetings = requireData(meetingResult) || [];
  const sent = requireData(sentResult) || [];
  const settings = requireData(settingsResult) || {};

  if (prospect?.source_payload?.is_test_record === true
    || String(prospect?.source_payload?.is_test_record || '').toLowerCase() === 'true') {
    return { allowed: false, reason: 'test_records_retired', stop: ['cancelled', 'test_records_retired'] };
  }

  if (enforceSendControls) {
    const executionControl = outreachExecutionControl(settings, now);
    if (!executionControl.allowed) return { allowed: false, reason: executionControl.reason };
  }

  if (!prospect) return { allowed: false, reason: 'prospect_missing', stop: ['cancelled', 'prospect_missing'] };
  if (['replied', 'booked', 'suppressed', 'completed', 'archived', 'rejected', 'held'].includes(prospect.status)) {
    const target = prospect.status === 'replied' ? 'replied'
      : prospect.status === 'booked' ? 'booked'
        : prospect.status === 'suppressed' ? 'suppressed' : 'cancelled';
    return { allowed: false, reason: `prospect_${prospect.status}`, stop: [target, `prospect_${prospect.status}`] };
  }
  if (!['approved', 'outreach'].includes(prospect.status)) {
    return { allowed: false, reason: 'prospect_not_approved', stop: ['cancelled', 'prospect_not_approved'] };
  }
  if (!prospect.company_id || !prospect.opportunity_id) {
    return { allowed: false, reason: 'crm_not_reconciled', stop: ['cancelled', 'crm_not_reconciled'] };
  }
  const [companyResult, opportunityResult] = await Promise.all([
    db.from('bd_companies').select('id').eq('tenant_id', sequence.tenant_id)
      .eq('id', prospect.company_id).is('deleted_at', null).maybeSingle(),
    db.from('bd_opportunities').select('id, company_id').eq('tenant_id', sequence.tenant_id)
      .eq('id', prospect.opportunity_id).is('deleted_at', null).maybeSingle(),
  ]);
  const company = requireData(companyResult);
  const opportunity = requireData(opportunityResult);
  if (!company || !opportunity || opportunity.company_id !== company.id) {
    return { allowed: false, reason: 'crm_links_inactive', stop: ['cancelled', 'crm_links_inactive'] };
  }
  if (!approval || approval.decision !== 'approved' || !approval.is_current) {
    return { allowed: false, reason: 'current_approval_missing', stop: ['cancelled', 'current_approval_missing'] };
  }
  if (!senderSettingsMatchApproval(approval, settings)) {
    return { allowed: false, reason: 'approved_sender_settings_changed', stop: ['cancelled', 'approved_sender_settings_changed'] };
  }
  if (initialApprovalExpired(approval, sequence)) {
    return { allowed: false, reason: 'initial_approval_expired', stop: ['cancelled', 'initial_approval_expired'] };
  }
  const recipient = normalizedEmail(prospect.contact_email);
  if (!recipient || !prospect.contact_manually_verified) return { allowed: false, reason: 'recipient_not_manually_verified' };
  if (normalizedEmail(approval.approved_recipient) !== recipient) return { allowed: false, reason: 'approved_recipient_mismatch', stop: ['cancelled', 'approved_recipient_mismatch'] };
  const steps = Array.isArray(prospect.draft_steps) ? prospect.draft_steps : [];
  if (steps.length !== 4 || !sameJson(steps, approval.approved_steps)) {
    return { allowed: false, reason: 'approved_copy_mismatch', stop: ['cancelled', 'approved_copy_mismatch'] };
  }
  const computedHash = draftHashFor({
    recipient,
    steps,
    evidence: approvalEvidenceSnapshot(prospect),
  });
  if (!prospect.draft_hash || computedHash !== prospect.draft_hash || computedHash !== approval.approved_draft_hash) {
    return { allowed: false, reason: 'approved_hash_mismatch', stop: ['cancelled', 'approved_hash_mismatch'] };
  }
  const domain = recipient.split('@')[1] || '';
  const [emailSuppressionResult, domainSuppressionResult] = await Promise.all([
    db.from('robbot3k_suppressions').select('id').eq('tenant_id', sequence.tenant_id).eq('email', recipient).limit(1),
    db.from('robbot3k_suppressions').select('id').eq('tenant_id', sequence.tenant_id).eq('domain', domain).limit(1),
  ]);
  if ((requireData(emailSuppressionResult) || []).length || (requireData(domainSuppressionResult) || []).length) {
    return { allowed: false, reason: 'recipient_suppressed', stop: ['suppressed', 'recipient_suppressed'] };
  }
  if (replies.length) return { allowed: false, reason: 'reply_exists', stop: ['replied', 'reply_exists'] };
  if (meetings.length) return { allowed: false, reason: 'meeting_exists', stop: ['booked', 'meeting_exists'] };
  const stepIndex = Number(sequence.current_step || 0);
  if (stepIndex < 0 || stepIndex >= 4 || Number(sequence.sent_count || 0) >= 4) {
    return { allowed: false, reason: 'sequence_complete', stop: ['completed', 'bounded_cadence_complete'] };
  }
  const existingMessage = sent.find((item) => Number(item.step_index) === stepIndex);
  let retryMessage = null;
  if (existingMessage) {
    if (['sent', 'delivered'].includes(existingMessage.status)) {
      return { allowed: false, reason: 'sent_step_needs_reconciliation', reconcileMessage: existingMessage, stepIndex };
    }
    const retry = failedMessageRetryState(existingMessage, now);
    if (retry.exhausted) {
      return { allowed: false, reason: retry.reason, stop: ['cancelled', retry.reason] };
    }
    if (!retry.retry) return { allowed: false, reason: retry.reason };
    retryMessage = existingMessage;
  }
  const step = steps[stepIndex];
  if (!step?.subject || !step?.body || Number(step.day ?? step.delayDays) !== CADENCE_DAYS[stepIndex]) {
    return { allowed: false, reason: 'approved_step_invalid', stop: ['cancelled', 'approved_step_invalid'] };
  }
  return { allowed: true, prospect, approval, recipient, steps, step, stepIndex, settings, retryMessage };
}

async function claimMessage(db, sequence, gate, provider, now = new Date()) {
  const idempotencyKey = `robbot3k:${sequence.id}:step:${gate.stepIndex}`;
  if (gate.retryMessage) {
    const attempts = Math.max(0, Number(gate.retryMessage.attempt_count || 0));
    const reclaimed = await db.from('robbot3k_messages').update({
      status: 'sending',
      attempt_count: attempts + 1,
      last_attempt_at: now.toISOString(),
      next_retry_at: null,
      error_code: null,
    })
      .eq('id', gate.retryMessage.id)
      .eq('tenant_id', sequence.tenant_id)
      .in('status', ['failed', 'sending'])
      .eq('attempt_count', attempts)
      .select('*')
      .maybeSingle();
    return requireData(reclaimed) || null;
  }
  const result = await db.from('robbot3k_messages').insert({
    tenant_id: sequence.tenant_id,
    prospect_id: sequence.prospect_id,
    sequence_id: sequence.id,
    approval_id: sequence.approval_id,
    direction: 'outbound',
    channel: 'email',
    step_index: gate.stepIndex,
    provider: provider.id,
    idempotency_key: idempotencyKey,
    from_email: gate.settings.from_email || null,
    to_email: gate.recipient,
    subject: gate.step.subject,
    body: gate.step.body,
    status: 'sending',
    attempt_count: 1,
    last_attempt_at: now.toISOString(),
  }).select('*').single();
  if (result.error && String(result.error.code) === '23505') return null;
  return requireData(result);
}

async function advanceSequenceAfterSent(db, sequence, stepIndex, sentAt = new Date()) {
  const nextStep = Number(stepIndex) + 1;
  const completed = nextStep >= 4;
  const crmOutcome = await recordRobBotCrmOutcome(db, {
    tenantId: sequence.tenant_id,
    prospectId: sequence.prospect_id,
    outcome: 'sent',
    actorType: 'agent',
    actorProfileId: null,
    idempotencyKey: `sent:${sequence.id}:${stepIndex}`,
    occurredAt: sentAt.toISOString(),
    metadata: { sequenceId: sequence.id, stepIndex },
  });
  if (!crmOutcome.linked) throw Object.assign(new Error('RobBot prospect is not reconciled to Avalon BD.'), { code: 'crm_not_reconciled' });
  const sequencePatch = {
    status: completed ? 'completed' : 'active',
    current_step: nextStep,
    sent_count: Math.max(Number(sequence.sent_count || 0), nextStep),
    last_sent_at: sentAt.toISOString(),
    next_due_at: completed ? null : addDays(sequence.started_at, CADENCE_DAYS[nextStep]),
    stop_reason: completed ? 'bounded_cadence_complete' : null,
  };
  const sequenceResult = await db.from('robbot3k_sequences').update(sequencePatch)
    .eq('id', sequence.id)
    .eq('tenant_id', sequence.tenant_id)
    .eq('current_step', stepIndex)
    .select('id')
    .maybeSingle();
  const advanced = requireData(sequenceResult);
  if (!advanced) return { advanced: false, completed };
  requireData(await db.from('robbot3k_prospects').update({
    status: completed ? 'completed' : 'outreach',
  }).eq('id', sequence.prospect_id).eq('tenant_id', sequence.tenant_id).select('id').single());
  return { advanced: true, completed };
}

async function reconcileProviderAttempt(db, sequence, gate, provider) {
  if (!gate.retryMessage) return null;
  const result = await provider.reconcile({
    idempotencyKey: gate.retryMessage.idempotency_key,
    providerMessageId: gate.retryMessage.provider_message_id || null,
    metadata: { prospectId: sequence.prospect_id, sequenceId: sequence.id, stepIndex: gate.stepIndex },
  });
  const status = String(result?.status || '').trim().toLowerCase();
  if (status === 'not_found') return null;
  if (!['sent', 'delivered'].includes(status)) {
    return { sent: false, reconciled: false, reason: 'provider_reconciliation_pending' };
  }
  const providerMessageId = String(result?.id || result?.messageId || gate.retryMessage.provider_message_id || '').trim() || null;
  const sentAt = result?.sentAt && !Number.isNaN(new Date(result.sentAt).getTime()) ? new Date(result.sentAt) : new Date();
  requireData(await db.from('robbot3k_messages').update({
    status: status === 'delivered' ? 'delivered' : 'sent',
    provider_message_id: providerMessageId,
    sent_at: sentAt.toISOString(),
    next_retry_at: null,
  }).eq('id', gate.retryMessage.id).eq('tenant_id', sequence.tenant_id).select('id').single());
  const advanced = await advanceSequenceAfterSent(db, sequence, gate.stepIndex, sentAt);
  return { sent: false, reconciled: true, providerMessageId, completed: advanced.completed };
}

async function sendApprovedStep(db, sequence, gate, provider, now = new Date()) {
  const reconciled = await reconcileProviderAttempt(db, sequence, gate, provider);
  if (reconciled) return reconciled;
  const message = await claimMessage(db, sequence, gate, provider, now);
  if (!message) return { sent: false, reason: 'idempotency_claim_exists' };
  let response;
  try {
    response = await provider.send({
      to: gate.recipient,
      from: gate.settings.from_email || '',
      fromName: gate.settings.sender_display_name || '',
      replyTo: gate.settings.reply_to_email || '',
      subject: gate.step.subject,
      text: gate.step.body,
      idempotencyKey: message.idempotency_key,
      metadata: { prospectId: sequence.prospect_id, sequenceId: sequence.id, stepIndex: gate.stepIndex },
    });
  } catch (error) {
    const exhausted = Number(message.attempt_count || 0) >= MAX_SEND_ATTEMPTS;
    try {
      await db.from('robbot3k_messages').update({
        status: 'failed', error_code: safeErrorCode(error, 'outreach_send_failed'),
        next_retry_at: exhausted ? null : new Date(Date.now() + retryDelayMs(message.attempt_count)).toISOString(),
      }).eq('id', message.id);
      if (exhausted) await stopSequence(db, sequence, 'cancelled', 'send_retry_exhausted');
    } catch { /* keep original provider error */ }
    throw error;
  }
  // From this point forward the provider reported success. Never downgrade
  // the message to failed if a later database write crashes; leaving it in
  // `sending` or `sent` routes the next run through reconciliation instead of
  // risking a duplicate send.
  const providerMessageId = String(response?.id || response?.messageId || '').trim() || null;
  const sentAt = new Date();
  requireData(await db.from('robbot3k_messages').update({
    status: 'sent', provider_message_id: providerMessageId, sent_at: sentAt.toISOString(), next_retry_at: null,
  }).eq('id', message.id).select('id').single());
  const advanced = await advanceSequenceAfterSent(db, sequence, gate.stepIndex, sentAt);
  return { sent: true, messageId: message.id, providerMessageId, completed: advanced.completed };
}

export async function executeDueOutreach(db, tenantId, actorProfileId, {
  triggerSource = 'manual', limit = 50, now = new Date(), provider = outreachProvider,
} = {}) {
  const clock = pacificClock(now);
  const run = requireData(await db.from('robbot3k_runs').insert({
    tenant_id: tenantId,
    run_type: 'outreach',
    trigger_source: triggerSource,
    status: 'running',
    pacific_local_date: clock.date,
    provider: provider?.id || 'unconfigured',
    provider_status: provider?.configured ? 'configured' : 'not_configured',
    created_by: actorProfileId,
  }).select('*').single());

  const requested = liveRequested();
  const providerReady = provider?.configured === true
    && provider?.supportsIdempotency === true
    && typeof provider?.send === 'function'
    && typeof provider?.reconcile === 'function';
  const live = requested && providerReady;
  const counts = { due: 0, eligible: 0, wouldSend: 0, sent: 0, reconciled: 0, blocked: 0, stopped: 0, failed: 0 };
  const results = [];
  try {
    let query = db.from('robbot3k_sequences').select('*')
      .in('status', ['ready', 'active'])
      .lte('next_due_at', now.toISOString())
      .order('next_due_at', { ascending: true })
      .limit(Math.min(Math.max(Number(limit) || 50, 1), 100));
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const sequences = requireData(await query) || [];
    counts.due = sequences.length;

    for (const sequence of sequences) {
      try {
        const gate = await gateSequence(db, sequence, now, {
          enforceSendControls: shouldEnforceOutreachControls({ live, triggerSource }),
        });
        if (gate.reconcileMessage) {
          const sentAt = gate.reconcileMessage.sent_at && !Number.isNaN(new Date(gate.reconcileMessage.sent_at).getTime())
            ? new Date(gate.reconcileMessage.sent_at)
            : now;
          await advanceSequenceAfterSent(db, sequence, gate.stepIndex, sentAt);
          counts.reconciled += 1;
          results.push({
            sequenceId: sequence.id,
            prospectId: sequence.prospect_id,
            outcome: 'reconciled',
            reason: 'sent_step_sequence_advanced',
            step: gate.stepIndex,
          });
          continue;
        }
        if (!gate.allowed) {
          counts.blocked += 1;
          if (gate.stop) {
            await stopSequence(db, sequence, gate.stop[0], gate.stop[1]);
            if (gate.stop[1] === 'approved_sender_settings_changed') {
              requireData(await db.from('robbot3k_prospects').update({ status: 'ready' })
                .eq('id', sequence.prospect_id)
                .eq('tenant_id', sequence.tenant_id)
                .select('id')
                .single());
            }
            counts.stopped += 1;
          }
          results.push({ sequenceId: sequence.id, prospectId: sequence.prospect_id, outcome: 'blocked', reason: gate.reason });
          continue;
        }
        counts.eligible += 1;
        if (!live) {
          counts.wouldSend += 1;
          results.push({
            sequenceId: sequence.id,
            prospectId: sequence.prospect_id,
            outcome: 'dry_run',
            reason: requested ? 'outreach_provider_not_configured' : 'live_send_disabled',
            step: gate.stepIndex,
          });
          continue;
        }
        const settingsReady = senderSettingsReady(gate.settings, provider.id);
        const complianceCopyReady = approvedBodiesContainPostalAddress(
          gate.steps,
          gate.settings.physical_postal_address,
        );
        if (!settingsReady || !complianceCopyReady) {
          counts.blocked += 1;
          results.push({
            sequenceId: sequence.id,
            prospectId: sequence.prospect_id,
            outcome: 'blocked',
            reason: !settingsReady
              ? 'sender_or_provider_settings_incomplete'
              : 'approved_postal_address_missing',
          });
          continue;
        }
        const sent = await sendApprovedStep(db, sequence, gate, provider, now);
        if (sent.sent) counts.sent += 1;
        else if (sent.reconciled) counts.reconciled += 1;
        else counts.blocked += 1;
        results.push({
          sequenceId: sequence.id,
          prospectId: sequence.prospect_id,
          outcome: sent.sent ? 'sent' : sent.reconciled ? 'reconciled' : 'blocked',
          reason: sent.reason || null,
        });
      } catch (error) {
        counts.failed += 1;
        console.warn('[robbot3k/execute] prospect failed', {
          ...safeLogContext(error, 'robbot3k_sequence_failed'), sequenceId: sequence.id,
        });
        results.push({ sequenceId: sequence.id, prospectId: sequence.prospect_id, outcome: 'failed', reason: safeErrorCode(error, 'sequence_failed') });
      }
    }

    requireData(await db.from('robbot3k_runs').update({
      status: counts.failed && !counts.sent && !counts.wouldSend ? 'failed' : 'succeeded',
      provider_status: live ? 'live' : requested ? 'not_configured' : 'dry_run',
      counts,
      error_code: counts.failed ? 'partial_sequence_failures' : null,
      finished_at: new Date().toISOString(),
    }).eq('id', run.id).select('id').single());
    await writeAuditEvent(db, {
      tenantId,
      actorProfileId,
      action: 'robbot3k_due_outreach_evaluated',
      entityType: 'robbot3k_run',
      entityId: run.id,
      phiTouched: false,
      payload: { triggerSource, live, provider: provider?.id || 'unconfigured', ...counts },
    });
    return {
      ok: true,
      runId: run.id,
      mode: live ? 'live' : 'dry_run',
      liveSendEnabled: live,
      provider: provider?.id || 'unconfigured',
      providerStatus: providerReady ? 'configured' : 'not_configured',
      counts,
      results,
    };
  } catch (error) {
    try {
      await db.from('robbot3k_runs').update({
        status: 'failed', error_code: safeErrorCode(error, 'robbot3k_outreach_failed'), finished_at: new Date().toISOString(),
      }).eq('id', run.id);
    } catch { /* preserve original */ }
    console.warn('[robbot3k/execute] failed', safeLogContext(error, 'robbot3k_outreach_failed'));
    throw error;
  }
}

export function executionIdempotencyPreview(sequenceId, stepIndex) {
  return crypto.createHash('sha256').update(`robbot3k:${sequenceId}:step:${stepIndex}`).digest('hex');
}
