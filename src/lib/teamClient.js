// Unified data layer for /admin/team. In live mode (Supabase) it calls the
// admin API; in demo mode (no Supabase) it reads/writes a sessionStorage roster
// so the screen is fully interactive — invites, role changes, deactivation, and
// password resets all work and persist until the tab is reloaded.
import { apiGet, apiPost } from './apiClient';
import { TEAM_MEMBERS, PENDING_INVITES } from '@/data/teamMockData';

const DEMO_KEY = 'av.demo.team';
const FAIL = (msg) => { throw new Error(msg); };

// ── Demo store (sessionStorage) ───────────────────────────────────────────
function seed() {
  return {
    members: TEAM_MEMBERS.map((m) => ({ ...m })),
    invites: PENDING_INVITES.map((i) => ({ ...i })),
  };
}
function readDemo() {
  try {
    const raw = sessionStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fall through to seed */ }
  const fresh = seed();
  writeDemo(fresh);
  return fresh;
}
function writeDemo(state) {
  try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  return state;
}
function demoId(prefix) {
  const rnd = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return `${prefix}_${rnd.slice(0, 8)}`;
}
function activeAdminCount(members) {
  return members.filter((m) => m.role === 'admin' && m.status === 'active').length;
}
// Mirror of api/_lib/team-core.js decideDropsLastAdmin (kept inline to avoid
// importing server code into the client bundle).
function dropsLastAdmin(member, { nextRole, nextStatus }, count) {
  const wasActiveAdmin = member.role === 'admin' && member.status === 'active';
  if (!wasActiveAdmin) return false;
  const stays = (nextRole ?? member.role) === 'admin' && (nextStatus ?? member.status) === 'active';
  if (stays) return false;
  return count <= 1;
}

const demo = {
  list() {
    const s = readDemo();
    return { members: s.members, invites: s.invites };
  },
  invite({ email, role, fullName, phone, delivery }) {
    const s = readDemo();
    const clean = String(email || '').trim().toLowerCase();
    if (s.members.some((m) => m.email === clean && m.status === 'active')) FAIL('That person already has admin access.');
    s.invites = s.invites.filter((i) => !(i.email === clean && i.invited_role === role));
    s.invites.unshift({
      id: demoId('inv'), email: clean, phone: phone || null, full_name: fullName || null,
      invited_role: role, status: 'pending',
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(), created_at: new Date().toISOString(),
    });
    writeDemo(s);
    return { ok: true, delivered: { email: delivery !== 'sms', sms: delivery !== 'email' } };
  },
  resend(inviteId) {
    const s = readDemo();
    const inv = s.invites.find((i) => i.id === inviteId && i.status === 'pending') || FAIL('No pending invite found.');
    inv.expires_at = new Date(Date.now() + 14 * 86400000).toISOString();
    writeDemo(s);
    return { ok: true };
  },
  revoke(inviteId) {
    const s = readDemo();
    s.invites = s.invites.filter((i) => i.id !== inviteId);
    writeDemo(s);
    return { ok: true };
  },
  updateRole(profileId, role) {
    const s = readDemo();
    const m = s.members.find((x) => x.id === profileId) || FAIL('Team member not found.');
    if (dropsLastAdmin(m, { nextRole: role }, activeAdminCount(s.members))) FAIL("You can't demote the last admin.");
    m.role = role;
    writeDemo(s);
    return { ok: true };
  },
  deactivate(profileId, reactivate) {
    const s = readDemo();
    const m = s.members.find((x) => x.id === profileId) || FAIL('Team member not found.');
    const nextStatus = reactivate ? 'active' : 'inactive';
    if (!reactivate && dropsLastAdmin(m, { nextStatus }, activeAdminCount(s.members))) FAIL("You can't remove the last admin.");
    m.status = nextStatus;
    m.deactivated_at = reactivate ? null : new Date().toISOString();
    writeDemo(s);
    return { ok: true, status: nextStatus };
  },
  resetPassword(profileId, mode) {
    const s = readDemo();
    s.members.find((x) => x.id === profileId) || FAIL('Team member not found.');
    if (mode === 'temp') return { ok: true, mode: 'temp', tempPassword: demoId('Av').replace('_', '') + 'x9', mustChange: true };
    return { ok: true, mode: 'email' };
  },
};

// ── Public API: branch on isDemo ──────────────────────────────────────────
export const teamClient = {
  list: (isDemo) => (isDemo ? Promise.resolve(demo.list()) : apiGet('/api/admin/team/list')),
  invite: (isDemo, p) => (isDemo ? Promise.resolve(demo.invite(p)) : apiPost('/api/admin/team/invite', p)),
  resend: (isDemo, inviteId, delivery) => (isDemo ? Promise.resolve(demo.resend(inviteId)) : apiPost('/api/admin/team/resend', { inviteId, delivery })),
  revoke: (isDemo, inviteId) => (isDemo ? Promise.resolve(demo.revoke(inviteId)) : apiPost('/api/admin/team/revoke', { inviteId })),
  updateRole: (isDemo, profileId, role) => (isDemo ? Promise.resolve(demo.updateRole(profileId, role)) : apiPost('/api/admin/team/update-role', { profileId, role })),
  deactivate: (isDemo, profileId, reactivate) => (isDemo ? Promise.resolve(demo.deactivate(profileId, reactivate)) : apiPost('/api/admin/team/deactivate', { profileId, reactivate })),
  resetPassword: (isDemo, profileId, mode) => (isDemo ? Promise.resolve(demo.resetPassword(profileId, mode)) : apiPost('/api/admin/team/reset-password', { profileId, mode })),
};
