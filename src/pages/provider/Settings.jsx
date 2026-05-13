import React, { useState } from 'react';
import {
  ToggleLeft, ToggleRight, CheckCircle, XCircle, Settings2,
  Zap, AlertCircle,
} from 'lucide-react';
import AdminLayout from '@/layouts/AdminLayout';
import { useToast } from '@/components/ui/use-toast';

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
    label: 'Membership Requests',
    description: 'Accept membership interest and pipeline entry from the site.',
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
    label: 'Payment Required Before Visit',
    description: 'Require full payment collection before nurse dispatch. Disabled during launch — invoice-based.',
    defaultOn: false,
    disabled: false,
  },
];

// ── Integration data ──────────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    id: 'int1',
    service: 'Payments (Square)',
    badgeStatus: 'Manual',
    description: 'Manual payment tracking active. Square links sent individually per client.',
  },
  {
    id: 'int2',
    service: 'Scheduling',
    badgeStatus: 'Manual',
    description: 'Manual booking via phone and email. No calendar API connected.',
  },
  {
    id: 'int3',
    service: 'SMS / Email',
    badgeStatus: 'Manual',
    description: 'Manual outreach via text and email during launch. No automation active.',
  },
  {
    id: 'int4',
    service: 'CRM',
    badgeStatus: 'Placeholder',
    description: 'Client data stored locally in admin command center. No external CRM connected.',
  },
  {
    id: 'int5',
    service: 'Dispatch',
    badgeStatus: 'Manual',
    description: 'Nurse assignment handled manually. No automated routing.',
  },
  {
    id: 'int6',
    service: 'Nursys License Checks',
    badgeStatus: 'Future',
    description: 'Planned post-launch. License verification will pull from Nursys API.',
  },
  {
    id: 'int7',
    service: 'Stripe Connect / Payroll',
    badgeStatus: 'Future',
    description: 'Planned post-launch. Nurse pay splits and payroll disbursement via Stripe Connect.',
  },
  {
    id: 'int8',
    service: 'Inventory Automation',
    badgeStatus: 'Manual',
    description: 'Manual kit tracking active. Inventory counts updated by admin.',
  },
  {
    id: 'int9',
    service: 'GFE Automation',
    badgeStatus: 'Placeholder',
    description: 'Manual clearance review active. GFE workflow automation planned for post-launch.',
  },
  {
    id: 'int10',
    service: 'Analytics',
    badgeStatus: 'Future',
    description: 'Reports snapshot mode active. Full analytics API integration planned post-launch.',
  },
];

// ── IntegrationStatusBadge ────────────────────────────────────────────────────

function IntegrationStatusBadge({ status }) {
  const map = {
    Manual:       'bg-blue-500/15 text-blue-400 border-blue-500/30',
    Placeholder:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Future:       'bg-foreground/10 text-foreground/50 border-foreground/20',
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
  const handleConfigure = () => {
    toast({ title: `${item.service}`, description: 'Integration configuration coming soon.' });
  };

  return (
    <div
      className="flex items-start justify-between gap-4 py-4 border-b last:border-0"
      style={{ borderColor: 'hsl(var(--foreground) / 0.07)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-body text-[13px] font-medium text-foreground">{item.service}</span>
          <IntegrationStatusBadge status={item.badgeStatus} />
        </div>
        <p className="font-body text-[11px] text-foreground/45 leading-relaxed">
          {item.description}
        </p>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('launch');
  const [toggleValues, setToggleValues] = useState(() => {
    const map = {};
    INITIAL_TOGGLES.forEach(t => { map[t.id] = t.defaultOn; });
    return map;
  });

  const handleToggleChange = (id, newValue) => {
    setToggleValues(prev => ({ ...prev, [id]: newValue }));
  };

  const allActive = INITIAL_TOGGLES.every(t => t.disabled || toggleValues[t.id]);

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
              No APIs are active. All integrations are placeholders. Configure buttons are non-functional until post-launch.
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
