import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from '@/components/ui/PageTransitionMotion';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  Layers3,
  Megaphone,
  MessageSquare,
  Radio,
  Send,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useCommunicationCenter } from '@/hooks/useCommunicationCenter';
import { useToast } from '@/components/ui/use-toast';
import { ACUITY_BOUNDARY_ITEMS, AVALON_COMMS_CONTRACT } from '@/lib/platformOps';

const tabs = [
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'channels', label: 'Channels', icon: Layers3 },
  { id: 'broadcast', label: 'Broadcast', icon: Radio },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'timeline', label: 'Timeline', icon: GitBranch },
  { id: 'announcements', label: 'Updates', icon: Megaphone },
];

const priorityStyle = {
  critical: 'border-red-400/35 bg-red-500/10 text-red-200',
  urgent: 'border-amber-300/35 bg-amber-400/10 text-amber-100',
  action: 'border-foreground/20 bg-foreground/[0.055] text-foreground',
  info: 'border-foreground/10 bg-foreground/[0.035] text-foreground/72',
};

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function toneForPriority(priority = 'info') {
  return priorityStyle[priority] || priorityStyle.info;
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.035] px-3 py-3 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2">
        <p className="font-body text-[9px] uppercase tracking-[0.2em] text-foreground/42">{label}</p>
        <Icon className="h-3.5 w-3.5 text-foreground/38" strokeWidth={1.7} />
      </div>
      <p className="mt-2 font-heading text-2xl uppercase leading-none text-foreground">{value}</p>
    </div>
  );
}

function TabButton({ tab, active, count, onClick }) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      aria-label={tab.label}
      onClick={onClick}
      className="relative inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-full px-3 font-body text-[10px] font-semibold uppercase tracking-[0.18em] transition-all md:flex-none md:px-4"
      style={{
        background: active ? 'hsl(var(--foreground))' : 'hsl(var(--foreground) / 0.055)',
        color: active ? 'hsl(var(--background))' : 'hsl(var(--foreground) / 0.62)',
        border: active ? '1px solid hsl(var(--foreground))' : '1px solid hsl(var(--foreground) / 0.1)',
      }}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      <span className="hidden sm:inline">{tab.label}</span>
      {count > 0 ? (
        <span
          className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-body text-[8px] font-bold"
          style={{
            background: active ? 'hsl(var(--background))' : 'hsl(var(--accent))',
            color: active ? 'hsl(var(--foreground))' : 'hsl(var(--background))',
          }}
        >
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </button>
  );
}

function AlertCard({ alert, onAck, onResolve }) {
  const isResolved = alert.status === 'resolved';
  const isAck = alert.status === 'acknowledged';
  return (
    <motion.article
      initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
      animate={{ opacity: isResolved ? 0.52 : 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
      className={`rounded-2xl border p-4 backdrop-blur-2xl ${toneForPriority(alert.priority)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-current/20 px-2 py-0.5 font-body text-[8px] font-semibold uppercase tracking-[0.16em] opacity-80">
              {alert.priority || 'info'}
            </span>
            <span className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/42">
              {alert.source || 'Avalon OS'}
            </span>
          </div>
          <h3 className="mt-2 font-heading text-xl uppercase leading-[0.95] tracking-[0.04em] text-foreground">
            {alert.title}
          </h3>
          {alert.body ? <p className="mt-2 font-body text-[12px] leading-relaxed text-foreground/62">{alert.body}</p> : null}
        </div>
        {isResolved ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" strokeWidth={1.7} />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0 text-foreground/48" strokeWidth={1.6} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {alert.actionLabel ? (
          <span className="rounded-full bg-background/82 px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.14em] text-foreground/58">
            {alert.actionLabel}
          </span>
        ) : null}
        {alert.requiresAck ? (
          <span className="rounded-full bg-background/82 px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.14em] text-foreground/58">
            Ack required
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-background/82 px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.12em] text-foreground/45">
          <Clock className="h-3 w-3" strokeWidth={1.7} />
          {formatTime(alert.updatedAt || alert.createdAt)}
        </span>
        <span className="rounded-full bg-background/82 px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.12em] text-foreground/45">
          {normalizeLabel(alert.status || 'open')}
        </span>
      </div>

      {!isResolved ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onAck(alert.id)}
            className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-xl border border-foreground/12 bg-background/82 px-3 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/72 transition-all hover:bg-foreground/10 active:scale-[0.98]"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={1.8} />
            {isAck ? 'Acked' : 'Ack'}
          </button>
          <button
            type="button"
            onClick={() => onResolve(alert.id)}
            className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-xl bg-foreground px-3 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-background transition-all active:scale-[0.98]"
          >
            Resolve
          </button>
        </div>
      ) : null}
    </motion.article>
  );
}

function normalizeLabel(value) {
  return String(value || '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clientMessageSender(from = '') {
  if (from === 'client') return 'You';
  if (from === 'nurse') return 'Nurse';
  return 'Care Team';
}

function MessageList({ role, channels = [], opsMessages, supportThread, onSend }) {
  const [draft, setDraft] = useState('');
  const [threadId, setThreadId] = useState('dispatch');
  const grouped = useMemo(() => {
    const groups = opsMessages.reduce((acc, message) => {
      const key = message.threadId || 'dispatch';
      if (!acc[key]) acc[key] = [];
      acc[key].push(message);
      return acc;
    }, {});
    return Object.entries(groups);
  }, [opsMessages]);
  const isClient = role === 'client';
  const channelGroups = channels.length
    ? channels.map((channel) => [channel.id, grouped.find(([key]) => key === channel.id)?.[1] || []])
    : grouped;
  const activeMessages = isClient
    ? supportThread.map((message) => ({
      id: message.id,
      from: clientMessageSender(message.from),
      text: message.text,
      createdAt: message.createdAt || message.at,
      role: message.from,
    }))
    : channelGroups.find(([key]) => key === threadId)?.[1] || [];

  const send = () => {
    if (!draft.trim()) return;
    onSend(draft.trim(), isClient ? {} : { threadId, audience: threadId === 'gfe' ? 'Clinical' : 'Dispatch' });
    setDraft('');
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[0.35fr_0.65fr]">
      {!isClient ? (
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-3">
          <p className="mb-3 font-body text-[9px] uppercase tracking-[0.2em] text-foreground/42">Threads</p>
          <div className="space-y-1.5">
            {(channelGroups.length ? channelGroups : [['dispatch', []]]).map(([key, messages]) => (
              <button
                key={key}
                type="button"
                onClick={() => setThreadId(key)}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-all"
                style={{
                  background: threadId === key ? 'hsl(var(--foreground) / 0.1)' : 'transparent',
                  color: threadId === key ? 'hsl(var(--foreground))' : 'hsl(var(--foreground) / 0.58)',
                }}
              >
                <span className="font-body text-[11px] font-semibold uppercase tracking-[0.14em]">{normalizeLabel(key)}</span>
                <span className="font-body text-[10px] text-foreground/38">{messages.length}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={isClient ? 'lg:col-span-2' : ''}>
        <div className="min-h-[330px] rounded-2xl border border-foreground/10 bg-background/82 p-3 backdrop-blur-2xl">
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {activeMessages.slice(0, 12).map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl border border-foreground/8 bg-foreground/[0.035] px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55">
                      {message.from}
                    </p>
                    <span className="shrink-0 font-body text-[9px] text-foreground/35">
                      {formatTime(message.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 font-body text-[12px] leading-relaxed text-foreground/72">{message.text}</p>
                  {message.delivery?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.delivery.map((delivery) => (
                        <span key={`${message.id}-${delivery.key}`} className="rounded-full border border-foreground/10 px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] text-foreground/42">
                          {delivery.label} {delivery.status}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') send();
            }}
            placeholder={isClient ? 'Message care team...' : 'Avalon group thread...'}
            className="min-h-[48px] min-w-0 flex-1 rounded-2xl border border-foreground/10 bg-foreground/[0.035] px-4 font-body text-[13px] text-foreground outline-none placeholder:text-foreground/32"
          />
          <button
            type="button"
            onClick={send}
            className="inline-flex min-h-[48px] min-w-[54px] items-center justify-center rounded-2xl bg-foreground text-background transition-all active:scale-[0.98]"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AcuityBoundaryPanel() {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-background/82 p-4 backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-body text-[9px] uppercase tracking-[0.22em] text-foreground/42">Boundary</p>
          <h3 className="font-heading text-2xl uppercase leading-none tracking-[0.04em] text-foreground">Acuity stays source</h3>
        </div>
        <FileText className="h-5 w-5 text-foreground/42" strokeWidth={1.7} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {ACUITY_BOUNDARY_ITEMS.map((item) => (
          <div key={item.label} className="rounded-xl border border-foreground/8 bg-foreground/[0.03] px-3 py-2.5">
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/58">{item.label}</p>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground/48">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelBoard({ channels }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[0.48fr_0.52fr]">
      <div className="grid gap-2 sm:grid-cols-2">
        {channels.map((channel) => (
          <motion.article
            key={channel.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 backdrop-blur-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/38">{channel.owner}</p>
                <h3 className="mt-1 font-heading text-2xl uppercase leading-none tracking-[0.04em] text-foreground">{channel.label}</h3>
              </div>
              <span className="rounded-full border border-foreground/10 bg-background/82 px-2 py-1 font-body text-[9px] uppercase tracking-[0.12em] text-foreground/45">
                {channel.status}
              </span>
            </div>
            <p className="mt-3 font-body text-[11px] leading-relaxed text-foreground/52">{channel.scope}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {channel.channels.map((item) => (
                <span key={`${channel.id}-${item}`} className="rounded-full bg-background/82 px-2 py-0.5 font-body text-[8px] uppercase tracking-[0.12em] text-foreground/42">
                  {item === 'sms' ? 'text' : item === 'chat' ? 'comms' : item.replace('_', ' ')}
                </span>
              ))}
            </div>
          </motion.article>
        ))}
      </div>
      <AcuityBoundaryPanel />
    </div>
  );
}

function BroadcastComposer({ channels, templates, onSend }) {
  const firstTemplate = templates[0] || {};
  const [templateId, setTemplateId] = useState(firstTemplate.id || '');
  const activeTemplate = templates.find((template) => template.id === templateId) || firstTemplate;
  const [channelId, setChannelId] = useState(activeTemplate.channelId || 'dispatch');
  const [audience, setAudience] = useState(activeTemplate.audience || 'Operations');
  const [message, setMessage] = useState('');
  const [requiresAck, setRequiresAck] = useState(Boolean(activeTemplate.requiresAck));
  const activeChannel = channels.find((channel) => channel.id === channelId) || channels[0];

  const chooseTemplate = (id) => {
    const next = templates.find((template) => template.id === id) || firstTemplate;
    setTemplateId(next.id || '');
    setChannelId(next.channelId || 'dispatch');
    setAudience(next.audience || 'Operations');
    setRequiresAck(Boolean(next.requiresAck));
    setMessage('');
  };

  const send = () => {
    onSend({
      templateId,
      channelId,
      audience,
      text: message,
      requiresAck,
    });
    setMessage('');
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[0.42fr_0.58fr]">
      <div className="space-y-3">
        <AcuityBoundaryPanel />
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 backdrop-blur-2xl">
          <p className="font-body text-[9px] uppercase tracking-[0.2em] text-foreground/42">Routing</p>
          <div className="mt-3 grid gap-2">
            <select
              value={templateId}
              onChange={(event) => chooseTemplate(event.target.value)}
              className="min-h-[44px] rounded-xl border border-foreground/10 bg-background px-3 font-body text-[12px] text-foreground outline-none"
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.label}</option>
              ))}
            </select>
            <select
              value={channelId}
              onChange={(event) => setChannelId(event.target.value)}
              className="min-h-[44px] rounded-xl border border-foreground/10 bg-background px-3 font-body text-[12px] text-foreground outline-none"
            >
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.label}</option>
              ))}
            </select>
            <input
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              className="min-h-[44px] rounded-xl border border-foreground/10 bg-background/82 px-3 font-body text-[12px] text-foreground outline-none"
            />
            <button
              type="button"
              onClick={() => setRequiresAck((value) => !value)}
              className="flex min-h-[42px] items-center justify-between rounded-xl border border-foreground/10 bg-background/82 px-3 text-left font-body text-[11px] uppercase tracking-[0.14em] text-foreground/58"
            >
              Require ack
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[9px]">{requiresAck ? 'On' : 'Off'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-foreground/10 bg-background/82 p-4 backdrop-blur-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-[9px] uppercase tracking-[0.2em] text-foreground/42">Broadcast Composer</p>
            <h3 className="font-heading text-2xl uppercase leading-none tracking-[0.04em] text-foreground">{activeTemplate.label || 'Broadcast'}</h3>
          </div>
          <span className="rounded-full border border-foreground/10 bg-foreground/[0.04] px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.12em] text-foreground/42">
            {activeChannel?.label || 'Channel'}
          </span>
        </div>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={activeTemplate.body || 'Write message...'}
          rows={8}
          className="w-full resize-none rounded-2xl border border-foreground/10 bg-foreground/[0.035] px-4 py-3 font-body text-[13px] leading-relaxed text-foreground outline-none placeholder:text-foreground/32"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="font-body text-[10px] uppercase tracking-[0.16em] text-foreground/38">
            {requiresAck ? 'Ack alert will be created' : 'Message only'}
          </p>
          <button
            type="button"
            onClick={send}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-foreground px-5 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-all active:scale-[0.98]"
          >
            <Send className="h-4 w-4" strokeWidth={1.8} />
            Send Broadcast
          </button>
        </div>
      </div>
    </div>
  );
}

function EscalationRail({ escalations, onRun }) {
  return (
    <div className="mb-4 rounded-2xl border border-foreground/10 bg-background/82 p-3 backdrop-blur-2xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-foreground/42" strokeWidth={1.7} />
          <p className="font-body text-[9px] uppercase tracking-[0.2em] text-foreground/42">Escalation sweep</p>
        </div>
        <button
          type="button"
          onClick={onRun}
          className="rounded-full border border-foreground/10 bg-foreground/[0.05] px-3 py-1.5 font-body text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/58"
        >
          Run
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {(escalations.length ? escalations : [{ id: 'clear', label: 'No escalations', detail: 'Comms rules are armed.', priority: 'clear' }]).map((item) => (
          <div key={item.id} className="min-w-[220px] rounded-xl border border-foreground/8 bg-foreground/[0.035] px-3 py-2.5">
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/62">{item.label}</p>
            <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground/42">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppointmentTimeline({ timeline }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[0.34fr_0.66fr]">
      <AcuityBoundaryPanel />
      <div className="rounded-2xl border border-foreground/10 bg-background/82 p-4 backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-[9px] uppercase tracking-[0.2em] text-foreground/42">Appointment log</p>
            <h3 className="font-heading text-2xl uppercase leading-none tracking-[0.04em] text-foreground">Message Timeline</h3>
          </div>
          <GitBranch className="h-5 w-5 text-foreground/42" strokeWidth={1.7} />
        </div>
        <div className="space-y-2">
          {timeline.map((item) => (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl border border-foreground/8 bg-foreground/[0.035] px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="truncate font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/55">{item.source}</p>
                <span className="shrink-0 font-body text-[9px] text-foreground/35">{formatTime(item.at)}</span>
              </div>
              <p className="mt-1 font-body text-[12px] font-semibold text-foreground/76">{item.title}</p>
              <p className="mt-1 font-body text-[11px] leading-relaxed text-foreground/52">{item.detail}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  );
}

function Announcements({ announcements, role, userId, onRead, onPublish }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState(role === 'provider' ? 'provider' : 'all');
  const [priority, setPriority] = useState('info');
  const canPublish = role === 'admin';

  const publish = () => {
    if (!title.trim() && !body.trim()) return;
    onPublish({ title, body, audience, priority });
    setTitle('');
    setBody('');
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[0.62fr_0.38fr]">
      <div className="space-y-3">
        {announcements.map((item) => {
          const read = (item.readBy || []).includes(userId);
          return (
            <motion.article
              key={item.id}
              className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 backdrop-blur-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-body text-[9px] uppercase tracking-[0.18em] text-foreground/42">
                    {(item.audience || []).join(' / ') || 'all'} · {formatTime(item.createdAt)}
                  </p>
                  <h3 className="mt-2 font-heading text-xl uppercase leading-[0.95] tracking-[0.04em] text-foreground">
                    {item.title}
                  </h3>
                  {item.body ? <p className="mt-2 font-body text-[12px] leading-relaxed text-foreground/62">{item.body}</p> : null}
                </div>
                {read ? <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-300" strokeWidth={1.7} /> : null}
              </div>
              {!read ? (
                <button
                  type="button"
                  onClick={() => onRead(item.id)}
                  className="mt-4 inline-flex min-h-[36px] items-center justify-center rounded-xl border border-foreground/12 bg-background/82 px-3 font-body text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/64"
                >
                  Mark read
                </button>
              ) : null}
            </motion.article>
          );
        })}
      </div>

      {canPublish ? (
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-4 backdrop-blur-2xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-body text-[9px] uppercase tracking-[0.2em] text-foreground/42">Publish</p>
              <h3 className="font-heading text-xl uppercase tracking-[0.06em] text-foreground">Announcement</h3>
            </div>
            <Radio className="h-4 w-4 text-foreground/42" strokeWidth={1.7} />
          </div>
          <div className="space-y-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title"
              className="min-h-[44px] w-full rounded-xl border border-foreground/10 bg-background/82 px-3 font-body text-[13px] text-foreground outline-none placeholder:text-foreground/32"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Short update..."
              rows={4}
              className="w-full resize-none rounded-xl border border-foreground/10 bg-background/82 px-3 py-3 font-body text-[13px] text-foreground outline-none placeholder:text-foreground/32"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                className="min-h-[42px] rounded-xl border border-foreground/10 bg-background px-3 font-body text-[12px] text-foreground outline-none"
              >
                <option value="all">All</option>
                <option value="client">Clients</option>
                <option value="provider">Nurses</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
                className="min-h-[42px] rounded-xl border border-foreground/10 bg-background px-3 font-body text-[12px] text-foreground outline-none"
              >
                <option value="info">Info</option>
                <option value="action">Action</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <button
              type="button"
              onClick={publish}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-foreground px-4 font-body text-[10px] font-semibold uppercase tracking-[0.16em] text-background transition-all active:scale-[0.98]"
            >
              Publish
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CommunicationCenter({ compact = false, roleOverride = null, initialTab = 'alerts' }) {
  const {
    role,
    userId,
    alerts,
    announcements,
    channels,
    templates,
    timeline,
    escalations,
    opsMessages,
    supportThread,
    snapshot,
    acknowledgeAlert,
    resolveAlert,
    publishAnnouncement,
    markRead,
    sendMessage,
    sendBroadcast,
    runEscalations,
  } = useCommunicationCenter({ roleOverride });
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab);
  const visibleAlerts = alerts.filter((alert) => alert.status !== 'resolved');
  const isClient = role === 'client';
  const isAdmin = role === 'admin' || role === 'superadmin';
  const visibleTabs = isClient
    ? tabs.filter((tab) => ['alerts', 'messages', 'announcements', 'timeline'].includes(tab.id))
    : isAdmin
      ? tabs
      : tabs.filter((tab) => ['alerts', 'messages', 'announcements', 'timeline'].includes(tab.id));

  const send = (text, options) => {
    sendMessage(text, options);
      toast({ title: 'Message sent', description: isClient ? 'Care team thread updated.' : 'Team thread updated.' });
  };

  const broadcast = (payload) => {
    if (!isAdmin) return;
    sendBroadcast(payload);
    toast({ title: 'Broadcast queued', description: 'Team communications routed it.' });
  };

  const sweep = () => {
    if (!isAdmin) return;
    const result = runEscalations();
    toast({ title: 'Sweep complete', description: `${result.length} rule${result.length === 1 ? '' : 's'} checked.` });
  };

  return (
    <section className="relative overflow-hidden rounded-[1.35rem] border border-foreground/10 bg-foreground/[0.025] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/25 to-transparent" />

      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-body text-[9px] uppercase tracking-[0.28em] text-foreground/40">
            {isClient ? 'Care channel' : 'Team communications'}
          </p>
          <h2 className="mt-1 font-heading text-3xl uppercase leading-none tracking-[0.04em] text-foreground md:text-4xl">
            {isClient ? 'Care Comms' : AVALON_COMMS_CONTRACT.service}
          </h2>
          {!isClient ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {['Group threads', 'Shift alerts', 'Announcements'].map((item) => (
                <span key={item} className="rounded-full border border-foreground/10 bg-foreground/[0.04] px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.14em] text-foreground/48">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-2 md:min-w-[360px]">
          <Stat label="Open" value={snapshot.activeAlerts} icon={Bell} />
          <Stat label="Hot" value={snapshot.urgentAlerts} icon={AlertTriangle} />
          <Stat label="New" value={snapshot.unreadAnnouncements} icon={Megaphone} />
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto rounded-full border border-foreground/10 bg-background/82 p-1">
        {visibleTabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={activeTab === tab.id}
            count={tab.id === 'alerts' ? visibleAlerts.length : tab.id === 'announcements' ? snapshot.unreadAnnouncements : tab.id === 'messages' ? snapshot.messages : 0}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      {isAdmin ? <EscalationRail escalations={escalations} onRun={sweep} /> : null}

      <AnimatePresence mode="wait">
        {activeTab === 'alerts' ? (
          <motion.div
            key="alerts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={compact ? 'grid gap-3' : 'grid gap-3 md:grid-cols-2'}
          >
            {visibleAlerts.length ? visibleAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAck={(id) => {
                  acknowledgeAlert(id);
                  toast({ title: 'Alert acknowledged' });
                }}
                onResolve={(id) => {
                  resolveAlert(id);
                  toast({ title: 'Alert resolved' });
                }}
              />
            )) : (
              <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.035] p-8 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-300" strokeWidth={1.7} />
                <p className="mt-3 font-body text-[12px] uppercase tracking-[0.18em] text-foreground/48">No open alerts</p>
              </div>
            )}
          </motion.div>
        ) : null}

        {activeTab === 'channels' && isAdmin ? (
          <motion.div
            key="channels"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ChannelBoard channels={channels} />
          </motion.div>
        ) : null}

        {activeTab === 'broadcast' && isAdmin ? (
          <motion.div
            key="broadcast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <BroadcastComposer channels={channels} templates={templates} onSend={broadcast} />
          </motion.div>
        ) : null}

        {activeTab === 'messages' ? (
          <motion.div
            key="messages"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <MessageList
              role={role}
              channels={channels}
              opsMessages={opsMessages}
              supportThread={supportThread}
              onSend={send}
            />
          </motion.div>
        ) : null}

        {activeTab === 'timeline' ? (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <AppointmentTimeline timeline={timeline} />
          </motion.div>
        ) : null}

        {activeTab === 'announcements' ? (
          <motion.div
            key="announcements"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Announcements
              announcements={announcements}
              role={role}
              userId={userId}
              onRead={markRead}
              onPublish={(payload) => {
                publishAnnouncement(payload);
                toast({ title: 'Announcement published' });
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
