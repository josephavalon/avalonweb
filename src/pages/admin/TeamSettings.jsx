// Admin → Team & User Settings (/admin/team). Admin-only.
// View staff + pending invites, invite new staff (email/SMS), change tier,
// deactivate/reactivate, and reset passwords. Live data via /api/admin/team/*;
// demo mode (no Supabase) shows a read-only mock roster.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyRound, Loader2, Mail, MoreHorizontal, Plus, RefreshCw, Shield, Trash2, UserCheck, X,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import PageShell from '@/components/admin/PageShell';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/lib/useAuthStore';
import { teamClient } from '@/lib/teamClient';

const FIELD = 'min-h-[46px] w-full rounded-2xl border border-foreground/10 bg-background/72 px-4 font-body text-base text-foreground placeholder:text-foreground/35 focus:border-foreground/30 focus:outline-none';
const LABEL = 'mb-2 block font-body text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45';

function RoleBadge({ role }) {
  const isAdmin = role === 'admin';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-body text-[11px] font-bold uppercase tracking-[0.12em] ${
      isAdmin ? 'border-foreground/30 bg-foreground/[0.10] text-foreground' : 'border-foreground/15 text-foreground/65'
    }`}>
      {isAdmin && <Shield className="h-3 w-3" strokeWidth={2} />}
      {isAdmin ? 'Full Admin' : 'Staff'}
    </span>
  );
}

const STATUS_STYLE = {
  active:   { label: 'Active',   color: 'hsl(152 60% 45%)', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)' },
  inactive: { label: 'Inactive', color: 'hsl(0 0% 60%)',    bg: 'rgba(160,160,160,0.12)', border: 'rgba(160,160,160,0.22)' },
  pending:  { label: 'Invited',  color: 'hsl(38 92% 55%)',  bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.28)' },
};

function StatusPill({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.inactive;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-body text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
      {s.label}
    </span>
  );
}

function Monogram({ name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-foreground/10 bg-foreground/[0.06] font-heading text-xl uppercase leading-none text-foreground">
      {initial}
    </span>
  );
}

const GROUPS = [
  { key: 'admin', label: 'Admin' },
  { key: 'avalon', label: 'Avalon Staff' },
  { key: 'clinical', label: 'Clinical Staff' },
];

function GroupToggle({ value, onChange }) {
  return (
    <div className="mb-5 flex rounded-full border border-foreground/10 bg-foreground/[0.04] p-1">
      {GROUPS.map((g) => {
        const active = g.key === value;
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => onChange(g.key)}
            className={`flex-1 truncate rounded-full px-3 py-2 text-center font-body text-[12px] font-semibold transition-colors ${
              active ? 'bg-foreground text-background' : 'text-foreground/55 hover:text-foreground/80'
            }`}
          >
            {g.label}
          </button>
        );
      })}
    </div>
  );
}

function Banner({ kind, children, onClose }) {
  if (!children) return null;
  const tone = kind === 'error'
    ? 'border-red-500/30 bg-red-500/10 text-red-200'
    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 font-body text-sm ${tone}`}>
      <span>{children}</span>
      {onClose && <button type="button" onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>}
    </div>
  );
}

export default function TeamSettings() {
  const { user, authBackend } = useAuthStore();
  const isDemo = authBackend !== 'supabase';
  const canManageTeam = isDemo || user?.role === 'admin';

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [manage, setManage] = useState(null); // selected member
  const [group, setGroup] = useState('admin'); // visual grouping toggle

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await teamClient.list(isDemo);
      setMembers(data?.members || []);
      setInvites(data?.invites || []);
    } catch (err) {
      setError(err?.message || 'Could not load the team.');
    } finally { setLoading(false); }
  }, [isDemo]);

  useEffect(() => { load(); }, [load]);

  const adminCount = useMemo(
    () => members.filter((m) => m.role === 'admin' && m.status === 'active').length,
    [members],
  );
  // Deactivated members drop out of the main roster (deactivating = removing
  // access should clear them from view) and live in a separate, reversible
  // "Deactivated" section.
  const activeMembers = useMemo(() => members.filter((m) => m.status !== 'inactive'), [members]);
  const deactivatedMembers = useMemo(() => members.filter((m) => m.status === 'inactive'), [members]);

  const actions = canManageTeam ? (
    <Button onClick={() => setInviteOpen(true)} className="gap-2">
      <Plus className="h-4 w-4" /> Invite staff
    </Button>
  ) : null;

  return (
    <AdminShell title="Team">
      <PageShell embedded subtitle="Manage who can access the Avalon admin console." action={actions}>
        {isDemo && (
          <Banner kind="success">
            Demo mode — fully interactive with a sample roster. Changes are local and reset when you reload.
          </Banner>
        )}
        <Banner kind="error" onClose={() => setError(null)}>{error}</Banner>
        <Banner kind="success" onClose={() => setNotice(null)}>{notice}</Banner>

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-foreground/50"><Loader2 className="h-4 w-4 animate-spin" /> Loading team…</div>
        ) : (
          <>
            {/* Grouping toggle (visual for now — Admin is the populated tab) */}
            <GroupToggle value={group} onChange={setGroup} />

            {/* Roster */}
            {group !== 'admin' ? (
              <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] px-5 py-12 text-center">
                <p className="font-body text-sm text-foreground/55">No {group === 'avalon' ? 'Avalon' : 'Clinical'} staff yet.</p>
                <p className="mt-1 font-body text-[12px] text-foreground/35">You'll be able to add them here later.</p>
              </div>
            ) : activeMembers.length === 0 ? (
              <div className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] px-5 py-12 text-center font-body text-sm text-foreground/50">
                No staff yet. Invite your first teammate.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {activeMembers.map((m) => (
                  <div key={m.id} className="rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] p-5">
                    <div className="flex items-center gap-3.5">
                      <Monogram name={m.full_name || m.email} />
                      <div className="min-w-0">
                        <p className="truncate font-body text-base font-semibold text-foreground">{m.full_name || m.email}</p>
                        <p className="truncate font-body text-[12px] text-foreground/45">{m.email}</p>
                      </div>
                    </div>
                    <div className="my-4 border-t border-foreground/[0.08]" />
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 font-body text-[12px] text-foreground/45">
                      <RoleBadge role={m.role} />
                      <StatusPill status={m.status} />
                      <span className="text-foreground/25">·</span>
                      <span>Joined {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</span>
                    </div>
                    <div className="mt-4">
                      {canManageTeam ? (
                        <Button variant="outline" className="w-full gap-1.5 border-foreground/20 hover:bg-foreground/[0.05]" onClick={() => setManage(m)}>
                          <MoreHorizontal className="h-4 w-4" /> Manage
                        </Button>
                      ) : (
                        <span className="block text-center font-body text-[11px] uppercase tracking-[0.14em] text-foreground/35">View only</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pending invites */}
            {invites.length > 0 && (
              <div className="mt-7">
                <h3 className="mb-3 font-heading text-xl uppercase tracking-[0.04em] text-foreground/80">Pending invites</h3>
                <div className="overflow-hidden rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] divide-y divide-foreground/[0.06]">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-body text-sm font-semibold text-foreground">{inv.email}</p>
                        <p className="font-body text-[12px] text-foreground/45">
                          {inv.invited_role === 'admin' ? 'Full Admin' : 'Staff'} · expires {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      {canManageTeam && (
                        <div className="flex items-center gap-2">
                          <InviteRowActions invite={inv} isDemo={isDemo} onDone={(msg) => { setNotice(msg); load(); }} onErr={setError} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Deactivated members — out of the main roster, still reactivatable */}
            {group === 'admin' && deactivatedMembers.length > 0 && (
              <div className="mt-7">
                <h3 className="mb-3 font-heading text-xl uppercase tracking-[0.04em] text-foreground/55">Deactivated</h3>
                <div className="overflow-hidden rounded-[1.4rem] border border-foreground/[0.10] bg-foreground/[0.02] divide-y divide-foreground/[0.06]">
                  {deactivatedMembers.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <div className="min-w-0">
                        <p className="truncate font-body text-sm font-semibold text-foreground/65">{m.full_name || m.email}</p>
                        <p className="truncate font-body text-[12px] text-foreground/40">
                          {m.email} · {m.role === 'admin' ? 'Full Admin' : 'Staff'} · access removed
                        </p>
                      </div>
                      {canManageTeam && (
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setManage(m)}>
                          <UserCheck className="h-4 w-4" /> Manage
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </PageShell>

      {inviteOpen && canManageTeam && (
        <InviteDialog
          open={inviteOpen}
          isDemo={isDemo}
          onClose={() => setInviteOpen(false)}
          onDone={(msg) => { setInviteOpen(false); setNotice(msg); load(); }}
          onErr={setError}
        />
      )}
      {manage && canManageTeam && (
        <ManageDialog
          member={manage}
          isDemo={isDemo}
          adminCount={adminCount}
          currentUserId={user?.id}
          onClose={() => setManage(null)}
          onDone={(msg) => { setManage(null); setNotice(msg); load(); }}
          onErr={(msg) => { setManage(null); setError(msg); }}
        />
      )}
    </AdminShell>
  );
}

function InviteRowActions({ invite, isDemo, onDone, onErr }) {
  const [busy, setBusy] = useState('');
  const act = async (kind) => {
    setBusy(kind);
    try {
      if (kind === 'resend') { await teamClient.resend(isDemo, invite.id, invite.phone ? 'both' : 'email'); onDone('Invite resent.'); }
      else { await teamClient.revoke(isDemo, invite.id); onDone('Invite revoked.'); }
    } catch (err) { onErr(err?.message || 'Action failed.'); } finally { setBusy(''); }
  };
  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5" disabled={!!busy} onClick={() => act('resend')}>
        {busy === 'resend' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Resend
      </Button>
      <Button variant="ghost" size="sm" className="gap-1.5 text-red-300 hover:text-red-200" disabled={!!busy} onClick={() => act('revoke')}>
        {busy === 'revoke' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Revoke
      </Button>
    </>
  );
}

function InviteDialog({ open, isDemo, onClose, onDone, onErr }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('staff');
  const [delivery, setDelivery] = useState('email');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await teamClient.invite(isDemo, { email, phone, fullName, role, delivery });
      const warn = res?.warnings?.length ? ` (note: ${res.warnings.join(', ')})` : '';
      onDone(`Invite sent to ${email}.${warn}`);
    } catch (err) { onErr(err?.message || 'Could not send the invite.'); setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl uppercase tracking-[0.04em]">Invite staff</DialogTitle>
          <DialogDescription>They'll get a link (and/or code) to set their password and join.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={LABEL}>Full name (optional)</label>
            <input className={FIELD} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jordan Vale" />
          </div>
          <div>
            <label className={LABEL}>Email</label>
            <input className={FIELD} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@avalon.co" />
          </div>
          <div>
            <label className={LABEL}>Access level</label>
            <select className={FIELD} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="staff">Staff — customer, scheduling, billing</option>
              <option value="admin">Full Admin — everything, incl. team</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Send invite via</label>
            <select className={FIELD} value={delivery} onChange={(e) => setDelivery(e.target.value)}>
              <option value="email">Email link</option>
              <option value="sms">Text message (code)</option>
              <option value="both">Both</option>
            </select>
          </div>
          {(delivery === 'sms' || delivery === 'both') && (
            <div>
              <label className={LABEL}>Mobile number</label>
              <input className={FIELD} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 415 555 0123" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManageDialog({ member, isDemo, adminCount, currentUserId, onClose, onDone, onErr }) {
  const [busy, setBusy] = useState('');
  const [tempResult, setTempResult] = useState(null);
  const isSelf = member.id === currentUserId;
  const isLastAdmin = member.role === 'admin' && member.status === 'active' && adminCount <= 1;

  const run = async (label, fn) => {
    setBusy(label);
    try {
      return await fn();
    } catch (err) { onErr(err?.message || 'Action failed.'); return null; }
    finally { setBusy(''); }
  };

  const changeRole = async () => {
    const next = member.role === 'admin' ? 'staff' : 'admin';
    const res = await run('role', () => teamClient.updateRole(isDemo, member.id, next));
    if (res) onDone(`${member.email} is now ${next === 'admin' ? 'Full Admin' : 'Staff'}.`);
  };
  const toggleActive = async () => {
    const reactivate = member.status !== 'active';
    const res = await run('active', () => teamClient.deactivate(isDemo, member.id, reactivate));
    if (res) onDone(reactivate ? `${member.email} reactivated.` : `${member.email} deactivated.`);
  };
  const resetEmail = async () => {
    const res = await run('reset', () => teamClient.resetPassword(isDemo, member.id, 'email'));
    if (res) onDone(`Reset email sent to ${member.email}.`);
  };
  const resetTemp = async () => {
    const res = await run('temp', () => teamClient.resetPassword(isDemo, member.id, 'temp'));
    if (res?.tempPassword) setTempResult(res.tempPassword);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl uppercase tracking-[0.04em]">{member.full_name || member.email}</DialogTitle>
          <DialogDescription>{member.email} · <RoleBadge role={member.role} /></DialogDescription>
        </DialogHeader>

        {tempResult ? (
          <div className="space-y-3">
            <p className="font-body text-sm text-foreground/70">Temporary password set. Share it securely — it won't be shown again. They'll be asked to change it on first sign-in.</p>
            <div className="rounded-2xl border border-foreground/15 bg-foreground/[0.05] px-4 py-3 text-center font-mono text-lg tracking-widest text-foreground">{tempResult}</div>
            <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-2.5">
            <ManageRow
              icon={Shield} label={member.role === 'admin' ? 'Change to Staff' : 'Promote to Full Admin'}
              hint={isLastAdmin ? "Can't demote the last admin" : null}
              disabled={isLastAdmin || !!busy} loading={busy === 'role'} onClick={changeRole}
            />
            <ManageRow icon={Mail} label="Send password-reset email" disabled={!!busy} loading={busy === 'reset'} onClick={resetEmail} />
            <ManageRow icon={KeyRound} label="Set a temporary password" disabled={!!busy} loading={busy === 'temp'} onClick={resetTemp} />
            {member.status === 'active' ? (
              <ManageRow
                icon={Trash2} label="Deactivate (remove access)" danger
                hint={isSelf ? "Can't deactivate yourself" : (isLastAdmin ? "Can't remove the last admin" : null)}
                disabled={isSelf || isLastAdmin || !!busy} loading={busy === 'active'} onClick={toggleActive}
              />
            ) : (
              <ManageRow icon={UserCheck} label="Reactivate" disabled={!!busy} loading={busy === 'active'} onClick={toggleActive} />
            )}
            <DialogFooter><Button variant="ghost" onClick={onClose} disabled={!!busy}>Close</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ManageRow({ icon: Icon, label, hint, danger, disabled, loading, onClick }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-2xl border border-foreground/[0.10] px-4 py-3 text-left font-body text-sm transition-colors disabled:opacity-40 ${
        danger ? 'text-red-300 hover:bg-red-500/[0.08]' : 'text-foreground hover:bg-foreground/[0.05]'
      }`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4 opacity-70" />}
      <span className="flex-1">{label}</span>
      {hint && <span className="font-body text-[11px] text-foreground/40">{hint}</span>}
    </button>
  );
}
