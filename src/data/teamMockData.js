// Read-only roster shown on /admin/team in demo mode (no Supabase). Mirrors the
// shape returned by /api/admin/team/list so the page renders identically.
export const TEAM_MEMBERS = [
  { id: 'm1', email: 'admin.preview@avalon.local', full_name: 'Avery Stone', phone: '(415) 555-0101', role: 'admin', status: 'active',   deactivated_at: null, must_change_password: false, created_at: '2025-09-01T00:00:00Z' },
  { id: 'm2', email: 'jordan.staff@avalon.local',  full_name: 'Jordan Vale',  phone: '(415) 555-0107', role: 'staff', status: 'active',   deactivated_at: null, must_change_password: false, created_at: '2026-02-04T00:00:00Z' },
  { id: 'm3', email: 'casey.front@avalon.local',   full_name: 'Casey Lim',    phone: '(415) 555-0108', role: 'staff', status: 'inactive', deactivated_at: '2026-04-30T00:00:00Z', must_change_password: false, created_at: '2026-01-10T00:00:00Z' },
];

export const PENDING_INVITES = [
  { id: 'i1', email: 'new.hire@avalon.local', phone: null, full_name: 'New Hire', invited_role: 'staff', status: 'pending', expires_at: '2026-06-28T00:00:00Z', created_at: '2026-06-14T00:00:00Z' },
];
