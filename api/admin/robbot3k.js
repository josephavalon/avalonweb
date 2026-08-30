import { writeAuditEvent } from '../_lib/audit-events.js';
import { reconcileRobBotProspectToBd } from '../_lib/bd-crm-core.js';
import {
  decideRobBotProspect,
  listRobBotDashboard,
  markRobBotBooked,
  markRobBotReply,
  runRobBotRefresh,
  suppressRobBotProspect,
  upsertManualRobBotProspect,
  updateRobBotProspect,
  updateRobBotSettings,
} from '../_lib/robbot3k-core.js';
import { executeDueOutreach } from '../_lib/robbot3k-execution.js';
import { safeErrorCode, safeLogContext } from '../_lib/safe-error.js';
import { requireAdmin } from '../_lib/supabase-auth.js';

const ACTIONS = new Set([
  'refresh', 'update_settings', 'create_manual_prospect', 'update_prospect', 'approve', 'hold', 'reject', 'revoke',
  'mark_reply', 'mark_booked', 'suppress', 'run_due_outreach',
]);

function migrationVersion(error, fallback = '046') {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const missing = code === '42p01' || code === 'pgrst205'
    || (message.includes('does not exist') && (message.includes('robbot3k_') || /(?:public\.)?bd_[a-z_]+/.test(message)));
  if (!missing) return null;
  if (/(?:public\.)?bd_[a-z_]+/.test(message)) return '048';
  if (message.includes('robbot3k_')) return '046';
  return fallback;
}

function failure(res, error, fallback = 'robbot3k_request_failed') {
  const migration = migrationVersion(error);
  if (migration) {
    return res.status(503).json({
      error: migration === '048'
        ? 'Avalon BD database migration 048 is required.'
        : 'RobBot3K database migration 046 is required.',
      code: migration === '048' ? 'avalon_bd_migration_required' : 'robbot3k_migration_required',
    });
  }
  const status = Number(error?.status) >= 400 && Number(error?.status) < 600 ? Number(error.status) : 500;
  return res.status(status).json({
    error: status >= 500 ? 'RobBot3K could not complete that request.' : String(error?.message || 'Request rejected.'),
    code: safeErrorCode(error, fallback),
  });
}

export default async function handler(req, res) {
  const authed = await requireAdmin(req, res);
  if (!authed) return;
  const { db, tenantId, user } = authed;
  if (!tenantId) return res.status(403).json({ error: 'Admin tenant is required.', code: 'tenant_required' });

  if (req.method === 'GET') {
    try {
      const dashboard = await listRobBotDashboard(db, tenantId, { limit: req.query?.limit, offset: req.query?.offset });
      await writeAuditEvent(db, {
        tenantId,
        actorProfileId: user?.id || null,
        action: 'robbot3k_admin_read',
        entityType: 'robbot3k_dashboard',
        phiTouched: false,
        payload: { scope: String(req.query?.scope || 'all'), resultCount: dashboard.prospects.length },
      });
      return res.status(200).json(dashboard);
    } catch (error) {
      console.warn('[admin/robbot3k] list failed', safeLogContext(error, 'robbot3k_list_failed'));
      return failure(res, error, 'robbot3k_list_failed');
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const action = String(body.action || '').trim();
  if (!ACTIONS.has(action)) return res.status(400).json({ error: 'Unknown RobBot3K action.', code: 'action_invalid' });
  const prospectId = String(body.prospectId || body.prospect_id || '').trim();
  if (!['refresh', 'update_settings', 'create_manual_prospect', 'run_due_outreach'].includes(action) && !prospectId) {
    return res.status(400).json({ error: 'Prospect id is required.', code: 'prospect_id_required' });
  }

  try {
    if (action === 'refresh') {
      const result = await runRobBotRefresh(db, tenantId, user?.id || null, { triggerSource: 'manual' });
      return res.status(200).json({ ...result, message: 'Atlas research refreshed. New findings remain unapproved.' });
    }
    if (action === 'update_settings') {
      const settings = await updateRobBotSettings(db, tenantId, user?.id || null, body.settings || body.patch || {});
      return res.status(200).json({
        ok: true,
        settings,
        config: { liveSendEnabled: false, providerConnected: false, sendMode: 'dry_run' },
        message: 'RobBot3K sender settings saved. No outreach provider is connected.',
      });
    }
    if (action === 'create_manual_prospect') {
      const result = await upsertManualRobBotProspect(
        db,
        tenantId,
        user?.id || null,
        body.prospect || body.manualProspect || body.manual_prospect || {},
      );
      let reconciliation;
      try {
        reconciliation = await reconcileRobBotProspectToBd(db, tenantId, user?.id || null, result.prospect.id);
      } catch (error) {
        console.warn('[admin/robbot3k] manual contact retained but CRM reconciliation failed', {
          ...safeLogContext(error, 'manual_prospect_crm_reconciliation_failed'),
          prospectId: result.prospect.id,
        });
        const crmMigration = migrationVersion(error, null);
        const status = crmMigration === '048'
          ? 503
          : Number(error?.status) >= 400 && Number(error?.status) < 500 ? Number(error.status) : 500;
        return res.status(status).json({
          ok: false,
          error: crmMigration === '048'
            ? 'Manual contact was saved in RobBot research, but Avalon BD migration 048 is required to create its CRM record.'
            : status < 500
              ? `${String(error?.message || 'CRM reconciliation needs review')} The RobBot research record was safely retained.`
              : 'Manual contact was saved in RobBot research, but its Avalon BD CRM record could not be created.',
          code: crmMigration === '048'
            ? 'manual_prospect_saved_crm_migration_required'
            : 'manual_prospect_saved_crm_reconciliation_failed',
          crmErrorCode: safeErrorCode(error, 'crm_reconciliation_failed'),
          researchRecordRetained: true,
          outreachExecuted: false,
          approvalGranted: false,
          prospect: result.prospect,
          crm: { connected: false },
        });
      }
      const links = reconciliation.prospectLinks;
      const crm = {
        connected: Boolean(links?.opportunity_id),
        companyId: links?.company_id || null,
        personId: links?.person_id || null,
        opportunityId: links?.opportunity_id || null,
        created: reconciliation.created,
      };
      return res.status(result.created ? 201 : 200).json({
        ok: true,
        ...result,
        prospect: { ...result.prospect, crm },
        crm,
        outreachExecuted: false,
        approvalGranted: false,
        message: result.created
          ? 'Manual contact added to research and Avalon BD. No email was sent.'
          : 'Existing contact updated, reconciled to Avalon BD, and returned to human review. No email was sent.',
      });
    }
    if (action === 'update_prospect') {
      const prospect = await updateRobBotProspect(
        db,
        tenantId,
        user?.id || null,
        prospectId,
        body.patch || {},
        { expectedDraftHash: body.expectedDraftHash || body.expected_draft_hash },
      );
      return res.status(200).json({ ok: true, prospect });
    }
    if (['approve', 'hold', 'reject', 'revoke'].includes(action)) {
      const decision = action === 'approve' ? 'approved' : action === 'hold' ? 'held' : action === 'reject' ? 'rejected' : 'revoked';
      const prospect = await decideRobBotProspect(
        db,
        tenantId,
        user?.id || null,
        prospectId,
        decision,
        body.reason,
        { expectedDraftHash: body.expectedDraftHash || body.expected_draft_hash },
      );
      return res.status(200).json({ ok: true, prospect, recipientConsentInferred: false });
    }
    if (action === 'mark_reply') {
      const prospect = await markRobBotReply(db, tenantId, user?.id || null, prospectId, {
        message: body.message,
        provider: 'manual',
        eventId: body.eventId,
      });
      return res.status(200).json({ ok: true, prospect });
    }
    if (action === 'mark_booked') {
      const prospect = await markRobBotBooked(db, tenantId, user?.id || null, prospectId, {
        scheduledAt: body.scheduledAt,
        externalId: body.externalId,
        bookingUrl: body.bookingUrl,
        provider: body.provider || 'manual',
      });
      return res.status(200).json({ ok: true, prospect });
    }
    if (action === 'suppress') {
      const prospect = await suppressRobBotProspect(db, tenantId, user?.id || null, prospectId, {
        email: body.email,
        reason: body.reason || 'admin',
        source: 'admin',
      });
      return res.status(200).json({ ok: true, prospect });
    }
    const result = await executeDueOutreach(db, tenantId, user?.id || null, {
      triggerSource: 'manual', limit: body.limit,
    });
    return res.status(200).json({
      ...result,
      message: result.mode === 'live'
        ? 'Due approved outreach executed through the connected provider.'
        : 'Dry run complete. No email was sent.',
    });
  } catch (error) {
    console.warn('[admin/robbot3k] action failed', {
      ...safeLogContext(error, 'robbot3k_action_failed'), action,
    });
    return failure(res, error, `robbot3k_${action}_failed`);
  }
}
