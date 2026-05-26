import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ToggleLeft, ToggleRight, Settings2,
  Zap, AlertCircle, FileText, Bell, Save, RotateCcw,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useToast } from '@/components/ui/use-toast';
import { ATTIO_PLACEHOLDER, isAttioConfigured } from '@/lib/attioPlaceholder';
import {
  GUSTO_PAYROLL_PLACEHOLDER,
  MERCURY_BANKING_PLACEHOLDER,
  NURSEYS_CREDENTIAL_PLACEHOLDER,
  QUALIPHY_GFE_PLACEHOLDER,
  QUICKBOOKS_ACCOUNTING_PLACEHOLDER,
  integrationConfigured,
} from '@/lib/financeIntegrations';
import {
  ACUITY_OPERATING_CONTRACT,
  AVALON_COMMS_CONTRACT,
  DEFAULT_NURSE_ALERT_SETTINGS,
  readNurseAlertSettings,
  saveNurseAlertSettings,
} from '@/lib/platformOps';

// ── Toggle data ───────────────────────────────────────────────────────────────

const INITIAL_TOGGLES = [
  {
    id: 't1',
    label: 'Manual Fulfillment Mode',
    description: 'All requests fulfilled manually via phone, text, and email. Cannot be disabled during launch.',
    defaultOn: true,
    disabled: true,
  },
  {
    id: 't2',
    label: 'Accepting Requests',
    description: 'New client requests are accepted and visible in the requests queue.',
    defaultOn: true,
    disabled: false,
  },
  {
    id: 't3',
    label: 'Same-Day Requests',
    description: 'Allow clients to submit same-day service requests.',
    defaultOn: true,
    disabled: false,
  },
  {
    id: 't4',
    label: 'Plan Requests',
    description: 'Accept subscription interest and pipeline entry from the site.',
    defaultOn: true,
    disabled: false,
  },
  {
    id: 't5',
    label: 'Hotel / Concierge Requests',
    description: 'Accept hotel and concierge channel requests.',
    defaultOn: true,
    disabled: false,
  },
  {
    id: 't6',
    label: 'Event Requests',
    description: 'Accept event and corporate group booking inquiries.',
    defaultOn: true,
    disabled: false,
  },
  {
    id: 't7',
    label: 'Available Today Badge',
    description: 'Display the "Available Today" availability badge on the public site.',
    defaultOn: true,
    disabled: false,
  },
  {
    id: 't8',
    label: 'Deposit Before Dispatch',
    description: 'Collect the $50 booking deposit before dispatch. Balance can stay manual during launch.',
    defaultOn: false,
    disabled: false,
  },
];

// ── Integration data ──────────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    id: 'int1',
    service: 'Payments (Stripe/Acuity)',
    badgeStatus: 'Manual',
    description: '$50 booking deposit, then manual balance review.',
  },
  {
    id: 'int2',
    service: ACUITY_OPERATING_CONTRACT.service,
    badgeStatus: ACUITY_OPERATING_CONTRACT.badgeStatus,
    description: ACUITY_OPERATING_CONTRACT.description,
    capabilities: ACUITY_OPERATING_CONTRACT.capabilities,
    contractLabel: 'Acuity Boundary',
  },
  {
    id: 'int3',
    service: AVALON_COMMS_CONTRACT.service,
    badgeStatus: AVALON_COMMS_CONTRACT.badgeStatus,
    description: AVALON_COMMS_CONTRACT.description,
    capabilities: AVALON_COMMS_CONTRACT.capabilities,
    contractLabel: 'Comms Contract',
  },
  {
    id: 'int4',
    service: ATTIO_PLACEHOLDER.service,
    badgeStatus: ATTIO_PLACEHOLDER.badgeStatus,
    description: ATTIO_PLACEHOLDER.description,
    contractLabel: 'CRM Sync Contract',
  },
  {
    id: 'int5',
    service: 'Dispatch',
    badgeStatus: 'Manual',
    description: 'Avalon owns nurse assignment, broadcasts, Y/N replies, route handoff, and client ETA messaging.',
  },
  {
    id: 'int6',
    service: NURSEYS_CREDENTIAL_PLACEHOLDER.service,
    badgeStatus: NURSEYS_CREDENTIAL_PLACEHOLDER.badgeStatus,
    description: NURSEYS_CREDENTIAL_PLACEHOLDER.description,
    capabilities: NURSEYS_CREDENTIAL_PLACEHOLDER.capabilities,
    contractLabel: 'Credential Contract',
  },
  {
    id: 'int7',
    service: GUSTO_PAYROLL_PLACEHOLDER.service,
    badgeStatus: GUSTO_PAYROLL_PLACEHOLDER.badgeStatus,
    description: GUSTO_PAYROLL_PLACEHOLDER.description,
    capabilities: GUSTO_PAYROLL_PLACEHOLDER.capabilities,
    contractLabel: 'Payroll Contract',
  },
  {
    id: 'int8',
    service: 'Inventory Automation',
    badgeStatus: 'Manual',
    description: 'Manual kit tracking active. Inventory counts updated by admin.',
  },
  {
    id: 'int9',
    service: QUALIPHY_GFE_PLACEHOLDER.service,
    badgeStatus: QUALIPHY_GFE_PLACEHOLDER.badgeStatus,
    description: QUALIPHY_GFE_PLACEHOLDER.description,
    capabilities: QUALIPHY_GFE_PLACEHOLDER.capabilities,
    contractLabel: 'GFE Fallback Contract',
  },
  {
    id: 'int10',
    service: 'Analytics',
    badgeStatus: 'Future',
    description: 'Reports snapshot mode active. Full analytics API integration planned post-launch.',
  },
  {
    id: 'int11',
    service: MERCURY_BANKING_PLACEHOLDER.service,
    badgeStatus: MERCURY_BANKING_PLACEHOLDER.badgeStatus,
    description: MERCURY_BANKING_PLACEHOLDER.description,
    capabilities: MERCURY_BANKING_PLACEHOLDER.capabilities,
    contractLabel: 'Banking Contract',
  },
  {
    id: 'int12',
    service: QUICKBOOKS_ACCOUNTING_PLACEHOLDER.service,
    badgeStatus: QUICKBOOKS_ACCOUNTING_PLACEHOLDER.badgeStatus,
    description: QUICKBOOKS_ACCOUNTING_PLACEHOLDER.description,
    capabilities: QUICKBOOKS_ACCOUNTING_PLACEHOLDER.capabilities,
    contractLabel: 'Books Contract',
  },
];

// ── IntegrationStatusBadge ────────────────────────────────────────────────────

function IntegrationStatusBadge({ status }) {
  const map = {
    Manual:       'bg-blue-500/15 text-blue-400 border-blue-500/30',
    Placeholder:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Future:       'bg-foreground/10 text-foreground/50 border-foreground/20',
    Configured:    'bg-teal-500/15 text-teal-300 border-teal-500/30',
    Active:       'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    'Active Later': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  };
  const cls = map[status] || 'bg-foreground/10 text-foreground/50 border-foreground/20';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide border ${cls}`}>
      {status}
    </span>
  );
}

// ── ToggleRow ─────────────────────────────────────────────────────────────────

function ToggleRow({ item, value, onChange }) {
  const isOn = value;

  return (
    <div
      className="flex items-start justify-between gap-4 py-4 border-b last:border-0"
      style={{ borderColor: 'hsl(var(--foreground) / 0.07)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-body text-[13px] font-medium text-foreground">{item.label}</span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide border"
            style={
              isOn
                ? { background: 'hsl(var(--accent) / 0.1)', color: 'hsl(var(--accent))', borderColor: 'hsl(var(--accent) / 0.3)' }
                : { background: 'hsl(var(--foreground) / 0.06)', color: 'hsl(var(--foreground) / 0.4)', borderColor: 'hsl(var(--foreground) / 0.15)' }
            }
          >
            {isOn ? 'Active' : 'Inactive'}
          </span>
          {item.disabled && (
            <span className="font-body text-[10px] text-foreground/35 italic">Always on</span>
          )}
        </div>
        <p className="font-body text-[11px] text-foreground/45 leading-relaxed">
          {item.description}
        </p>
      </div>

      <button
        onClick={() => !item.disabled && onChange(item.id, !isOn)}
        disabled={item.disabled}
        className="shrink-0 mt-0.5 transition-opacity"
        style={{ opacity: item.disabled ? 0.4 : 1, cursor: item.disabled ? 'not-allowed' : 'pointer' }}
        aria-label={`Toggle ${item.label}`}
      >
        {isOn ? (
          <ToggleRight
            className="w-8 h-8"
            style={{ color: 'hsl(var(--accent))' }}
            strokeWidth={1.5}
          />
        ) : (
          <ToggleLeft
            className="w-8 h-8 text-foreground/30"
            strokeWidth={1.5}
          />
        )}
      </button>
    </div>
  );
}

// ── IntegrationRow ────────────────────────────────────────────────────────────

function IntegrationRow({ item, toast }) {
  const isAttio = item.service === ATTIO_PLACEHOLDER.service;
  const capabilities = item.capabilities || (isAttio ? ATTIO_PLACEHOLDER.capabilities : []);
  const configured = isAttio ? isAttioConfigured() : integrationConfigured(item.service);
  const handleConfigure = () => {
    toast({
      title: `${item.service}`,
      description: configured
        ? 'Credentials detected. Connection screen is still pending.'
        : 'Staged for local launch mode.',
    });
  };

  return (
    <div
      className="flex items-start justify-between gap-4 py-4 border-b last:border-0"
      style={{ borderColor: 'hsl(var(--foreground) / 0.07)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-body text-[13px] font-medium text-foreground">{item.service}</span>
          <IntegrationStatusBadge status={configured ? 'Configured' : item.badgeStatus} />
        </div>
        <p className="font-body text-[11px] text-foreground/45 leading-relaxed">
          {item.description}
        </p>
        {capabilities.length > 0 && (
          <div className="mt-3 rounded-lg border border-foreground/[0.08] bg-foreground/[0.025] px-3 py-2">
            <div className="mb-2 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-foreground/35" strokeWidth={1.5} />
              <span className="font-body text-[10px] uppercase tracking-[0.18em] text-foreground/35">{item.contractLabel || 'Sync Contract'}</span>
            </div>
            <div className="grid gap-1">
              {capabilities.map((capability) => (
                <p key={capability} className="font-body text-[10px] leading-relaxed text-foreground/45">
                  {capability}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
      <button
        onClick={handleConfigure}
        className="shrink-0 mt-0.5 px-3 py-1.5 rounded-lg text-[11px] font-body font-medium transition-all active:scale-95"
        style={{
          background:   'hsl(var(--foreground) / 0.06)',
          color:        'hsl(var(--foreground) / 0.5)',
          border:       '1px solid hsl(var(--foreground) / 0.1)',
        }}
      >
        Configure
      </button>
    </div>
  );
}

function AlertChannelToggle({ label, description, enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className="flex min-h-[72px] items-center justify-between gap-4 rounded-xl border px-4 text-left transition-all active:scale-[0.99]"
      style={{
        background: enabled ? 'hsl(var(--accent) / 0.07)' : 'hsl(var(--foreground) / 0.025)',
        borderColor: enabled ? 'hsl(var(--accent) / 0.24)' : 'hsl(var(--foreground) / 0.08)',
      }}
    >
      <span>
        <span className="block font-body text-[13px] font-medium text-foreground">{label}</span>
        <span className="mt-1 block font-body text-[11px] leading-relaxed text-foreground/45">{description}</span>
      </span>
      {enabled ? (
        <ToggleRight className="h-8 w-8 shrink-0" style={{ color: 'hsl(var(--accent))' }} strokeWidth={1.5} />
      ) : (
        <ToggleLeft className="h-8 w-8 shrink-0 text-foreground/30" strokeWidth={1.5} />
      )}
    </button>
  );
}

function NurseAlertSettings({ toast }) {
  const [settings, setSettings] = useState(() => readNurseAlertSettings());
  const update = (patch) => setSettings((current) => ({
    ...current,
    ...patch,
    channels: {
      ...current.channels,
      ...(patch.channels || {}),
    },
  }));

  const save = () => {
    const next = saveNurseAlertSettings(settings);
    setSettings(next);
    toast({
      title: 'Nurse alerts updated',
      description: `Broadcasts repeat every ${next.repeatMinutes} minutes until assignment.`,
    });
  };

  const reset = () => {
    setSettings(DEFAULT_NURSE_ALERT_SETTINGS);
    saveNurseAlertSettings(DEFAULT_NURSE_ALERT_SETTINGS);
    toast({ title: 'Nurse alerts reset', description: 'Default local alert settings restored.' });
  };

  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border px-5 py-4"
        style={{ background: 'hsl(var(--foreground) / 0.03)', borderColor: 'hsl(var(--foreground) / 0.08)' }}
      >
        <div className="mb-1 flex items-center gap-2">
          <Bell className="h-4 w-4 text-foreground/50" strokeWidth={1.5} />
          <span className="font-body text-[12px] font-medium tracking-wide text-foreground/70">Assignment Broadcast Rules</span>
        </div>
        <p className="font-body text-[11px] leading-relaxed text-foreground/45">
          These controls edit the local nurse alert system. Real SMS/email/chat delivery can plug into this contract later without changing the nurse workflow.
        </p>
      </div>

      <div
        className="rounded-xl border p-5"
        style={{ background: 'hsl(var(--foreground) / 0.02)', borderColor: 'hsl(var(--foreground) / 0.08)' }}
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-foreground/[0.07] pb-5">
          <div>
            <p className="font-body text-[13px] font-medium text-foreground">Enable Nurse Assignment Alerts</p>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground/45">
              When enabled, new one-time visits and subscription starts create nurse assignment broadcasts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => update({ enabled: !settings.enabled })}
            aria-label="Toggle nurse assignment alerts"
          >
            {settings.enabled ? (
              <ToggleRight className="h-9 w-9" style={{ color: 'hsl(var(--accent))' }} strokeWidth={1.5} />
            ) : (
              <ToggleLeft className="h-9 w-9 text-foreground/30" strokeWidth={1.5} />
            )}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <AlertChannelToggle
            label="Avalon Group"
            description="Posts into Avalon Comms for dispatch and on-call nurses."
            enabled={settings.channels.chat}
            onChange={(value) => update({ channels: { chat: value } })}
          />
          <AlertChannelToggle
            label="Text Placeholder"
            description="Marks SMS as queued until a real provider is connected."
            enabled={settings.channels.sms}
            onChange={(value) => update({ channels: { sms: value } })}
          />
          <AlertChannelToggle
            label="Email Placeholder"
            description="Marks email as queued until delivery is connected."
            enabled={settings.channels.email}
            onChange={(value) => update({ channels: { email: value } })}
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="font-body text-[10px] uppercase tracking-[0.2em] text-foreground/40">Repeat Every Minutes</span>
            <input
              type="number"
              min="1"
              value={settings.repeatMinutes}
              onChange={(event) => update({ repeatMinutes: event.target.value })}
              className="mt-2 min-h-[48px] w-full rounded-xl border border-foreground/[0.10] bg-foreground/[0.03] px-4 font-body text-sm text-foreground outline-none"
            />
          </label>
          <label className="block">
            <span className="font-body text-[10px] uppercase tracking-[0.2em] text-foreground/40">Escalate After Minutes</span>
            <input
              type="number"
              min="1"
              value={settings.escalationAfterMinutes}
              onChange={(event) => update({ escalationAfterMinutes: event.target.value })}
              className="mt-2 min-h-[48px] w-full rounded-xl border border-foreground/[0.10] bg-foreground/[0.03] px-4 font-body text-sm text-foreground outline-none"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="font-body text-[10px] uppercase tracking-[0.2em] text-foreground/40">Recipients</span>
            <input
              type="text"
              value={settings.recipients}
              onChange={(event) => update({ recipients: event.target.value })}
              className="mt-2 min-h-[48px] w-full rounded-xl border border-foreground/[0.10] bg-foreground/[0.03] px-4 font-body text-sm text-foreground outline-none"
            />
          </label>
          <label className="block md:col-span-2">
            <span className="font-body text-[10px] uppercase tracking-[0.2em] text-foreground/40">Alert Template</span>
            <textarea
              value={settings.template}
              onChange={(event) => update({ template: event.target.value })}
              rows={3}
              className="mt-2 w-full resize-none rounded-xl border border-foreground/[0.10] bg-foreground/[0.03] px-4 py-3 font-body text-sm leading-relaxed text-foreground outline-none"
            />
            <span className="mt-1 block font-body text-[10px] text-foreground/35">
              Available variables: {'{{client}}'}, {'{{service}}'}, {'{{date}}'}, {'{{time}}'}, {'{{address}}'}
            </span>
          </label>
          <label className="block md:col-span-2">
            <span className="font-body text-[10px] uppercase tracking-[0.2em] text-foreground/40">Escalation Note</span>
            <textarea
              value={settings.escalationNote}
              onChange={(event) => update({ escalationNote: event.target.value })}
              rows={2}
              className="mt-2 w-full resize-none rounded-xl border border-foreground/[0.10] bg-foreground/[0.03] px-4 py-3 font-body text-sm leading-relaxed text-foreground outline-none"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={save}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-4 font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-background"
          >
            <Save className="h-4 w-4" strokeWidth={1.7} /> Save Alerts
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-foreground/[0.12] px-4 font-body text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/60"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.7} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(() => (
    ['launch', 'alerts', 'integrations'].includes(requestedTab) ? requestedTab : 'launch'
  ));
  const [toggleValues, setToggleValues] = useState(() => {
    const map = {};
    INITIAL_TOGGLES.forEach(t => { map[t.id] = t.defaultOn; });
    return map;
  });

  const handleToggleChange = (id, newValue) => {
    setToggleValues(prev => ({ ...prev, [id]: newValue }));
  };

  return (
    <AdminLayout>
      {/* Page header */}
      <div className="mb-6 space-y-1">
        <h1 className="font-heading text-2xl tracking-[0.15em] text-foreground uppercase">
          Settings
        </h1>
        <p className="font-body text-[12px] text-foreground/45 tracking-wide">
          Launch Controls &amp; Integration Registry
        </p>
      </div>

      {/* Tab toggle */}
      <div
        className="inline-flex rounded-xl p-1 mb-6"
        style={{ background: 'hsl(var(--foreground) / 0.06)' }}
      >
        {[
          { id: 'launch',       label: 'Launch Controls' },
          { id: 'alerts', label: 'Nurse Alerts' },
          { id: 'integrations', label: 'Integrations' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded-lg text-[12px] font-body font-medium transition-all"
            style={{
              background: activeTab === tab.id ? 'hsl(var(--background))' : 'transparent',
              color:      activeTab === tab.id ? 'hsl(var(--foreground))' : 'hsl(var(--foreground) / 0.5)',
              boxShadow:  activeTab === tab.id ? '0 1px 3px hsl(var(--foreground) / 0.1)' : 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Launch Controls tab ──────────────────────────────────────────────── */}
      {activeTab === 'launch' && (
        <div className="space-y-5">
          {/* Intro */}
          <div
            className="rounded-xl border px-5 py-4"
            style={{
              background:  'hsl(var(--foreground) / 0.03)',
              borderColor: 'hsl(var(--foreground) / 0.08)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Settings2 className="w-4 h-4 text-foreground/50" strokeWidth={1.5} />
              <span className="font-body text-[12px] font-medium text-foreground/70 tracking-wide">
                Manual Fulfillment Mode
              </span>
            </div>
            <p className="font-body text-[11px] text-foreground/45 leading-relaxed">
              All toggles control UI state only. No automation is connected during the launch phase.
            </p>
          </div>

          {/* Toggle list */}
          <div
            className="rounded-xl border px-5"
            style={{
              background:  'hsl(var(--foreground) / 0.02)',
              borderColor: 'hsl(var(--foreground) / 0.08)',
            }}
          >
            {INITIAL_TOGGLES.map(item => (
              <ToggleRow
                key={item.id}
                item={item}
                value={toggleValues[item.id]}
                onChange={handleToggleChange}
              />
            ))}
          </div>

          {/* Launch Mode Active banner */}
          <div
            className="rounded-xl border px-5 py-4 flex items-center gap-3"
            style={{
              background:  'hsl(var(--accent) / 0.06)',
              borderColor: 'hsl(var(--accent) / 0.35)',
            }}
          >
            <Zap
              className="w-5 h-5 shrink-0"
              style={{ color: 'hsl(var(--accent))' }}
              strokeWidth={1.5}
            />
            <div>
              <p
                className="font-body text-[12px] font-semibold tracking-wide"
                style={{ color: 'hsl(var(--accent))' }}
              >
                Launch Mode Active
              </p>
              <p className="font-body text-[11px] text-foreground/45 mt-0.5">
                All manual fulfillment controls are enabled. Operating in pre-API launch state.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && <NurseAlertSettings toast={toast} />}

      {/* ── Integrations tab ─────────────────────────────────────────────────── */}
      {activeTab === 'integrations' && (
        <div className="space-y-5">
          {/* Intro */}
          <div
            className="rounded-xl border px-5 py-4"
            style={{
              background:  'hsl(var(--foreground) / 0.03)',
              borderColor: 'hsl(var(--foreground) / 0.08)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
              <span className="font-body text-[12px] font-medium text-foreground/70 tracking-wide">
                Integration Registry
              </span>
            </div>
            <p className="font-body text-[11px] text-foreground/45 leading-relaxed">
              No APIs are active. All integrations are local fixtures. Configure buttons are non-functional until post-launch.
            </p>
          </div>

          {/* Integration list */}
          <div
            className="rounded-xl border px-5"
            style={{
              background:  'hsl(var(--foreground) / 0.02)',
              borderColor: 'hsl(var(--foreground) / 0.08)',
            }}
          >
            {INTEGRATIONS.map(item => (
              <IntegrationRow key={item.id} item={item} toast={toast} />
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
