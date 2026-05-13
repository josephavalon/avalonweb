// ── Avalon Vitality — Admin Mock Data ─────────────────────────────────────────
// Realistic SF Bay Area IV therapy business data.
// Replace with real API calls when backend is live.

export const STAFF = [
  { id: 's1', first_name: 'Joseph',   last_name: 'M.',       role: 'admin',      email: 'joseph@avalonvitality.co',   phone: '(415) 555-0101', is_active: true,  last_login: '2026-05-11T08:14:00Z', created_at: '2025-09-01T00:00:00Z' },
  { id: 's2', first_name: 'Stephanie', last_name: 'R.',      role: 'nurse',      email: 'stephanie@avalonvitality.co', phone: '(415) 555-0102', is_active: true,  last_login: '2026-05-10T17:42:00Z', created_at: '2025-10-12T00:00:00Z' },
  { id: 's3', first_name: 'Marcus',    last_name: 'T.',      role: 'nurse',      email: 'marcus@avalonvitality.co',    phone: '(415) 555-0103', is_active: true,  last_login: '2026-05-09T09:05:00Z', created_at: '2025-11-03T00:00:00Z' },
  { id: 's4', first_name: 'Priya',     last_name: 'K.',      role: 'nurse',      email: 'priya@avalonvitality.co',     phone: '(415) 555-0104', is_active: false, last_login: '2026-03-22T11:00:00Z', created_at: '2026-01-15T00:00:00Z' },
];

export const SERVICES = [
  { id: 'sv1', name: 'Myers Cocktail',       category: 'iv_therapy',  base_price: 200, duration_minutes: 60,  is_active: true,  description: 'Classic multi-vitamin IV blend. Magnesium, B vitamins, Vitamin C, calcium.' },
  { id: 'sv2', name: 'NAD+ Infusion',        category: 'iv_therapy',  base_price: 280, duration_minutes: 90,  is_active: true,  description: 'Cellular energy + cognitive support. 250mg NAD+ IV infusion.' },
  { id: 'sv3', name: 'CBD Recovery Drip',    category: 'iv_therapy',  base_price: 200, duration_minutes: 60,  is_active: true,  description: 'Anti-inflammatory support with broad-spectrum CBD and vitamin blend.' },
  { id: 'sv4', name: 'Hydration Boost',      category: 'iv_therapy',  base_price: 149, duration_minutes: 45,  is_active: true,  description: 'Pure isotonic saline + electrolytes. Fast rehydration.' },
  { id: 'sv5', name: 'Performance Drip',     category: 'iv_therapy',  base_price: 220, duration_minutes: 60,  is_active: true,  description: 'Pre/post-event blend. Amino acids, B12, magnesium, glutathione push.' },
  { id: 'sv6', name: 'Glutathione Push',     category: 'injection',   base_price: 75,  duration_minutes: 15,  is_active: true,  description: 'IV push add-on. Master antioxidant for skin + detox.' },
  { id: 'sv7', name: 'B12 Shot',             category: 'injection',   base_price: 35,  duration_minutes: 10,  is_active: true,  description: 'IM methylcobalamin. Energy + neurological support.' },
  { id: 'sv8', name: 'Immune Shield Drip',   category: 'iv_therapy',  base_price: 210, duration_minutes: 60,  is_active: true,  description: 'High-dose Vitamin C, Zinc, B-complex.' },
  { id: 'sv9', name: 'VIP Recovery Package', category: 'package',     base_price: 450, duration_minutes: 120, is_active: true,  description: 'Myers Cocktail + NAD+ push + Glutathione push + B12 shot.' },
  { id: 'sv10',name: 'Anti-Aging Drip',      category: 'iv_therapy',  base_price: 300, duration_minutes: 75,  is_active: false, description: 'Deprecated — replaced by VIP Recovery Package.' },
];

export const CLIENTS = [
  { id: 'c1',  first_name: 'Alex',     last_name: 'Chen',      email: 'alex.chen@gmail.com',         phone: '(415) 555-1001', city: 'San Francisco', zip: '94105', tags: ['vip', 'recurring'],      intake_completed: true,  is_active: true,  source: 'website',  total_spent: 1840, visit_count: 9,  last_visit: '2026-05-08', created_at: '2025-10-05' },
  { id: 'c2',  first_name: 'Maya',     last_name: 'Patel',     email: 'maya.patel@gmail.com',        phone: '(415) 555-1002', city: 'San Francisco', zip: '94110', tags: ['recurring'],             intake_completed: true,  is_active: true,  source: 'referral', total_spent: 940,  visit_count: 4,  last_visit: '2026-04-28', created_at: '2025-11-12' },
  { id: 'c3',  first_name: 'Tyler',    last_name: 'Brooks',    email: 'tyler.brooks@gmail.com',      phone: '(415) 555-1003', city: 'Palo Alto',     zip: '94301', tags: ['corporate'],             intake_completed: true,  is_active: true,  source: 'corporate',total_spent: 2200, visit_count: 11, last_visit: '2026-05-02', created_at: '2025-09-20' },
  { id: 'c4',  first_name: 'Serena',   last_name: 'Williams',  email: 'serena.w@gmail.com',          phone: '(415) 555-1004', city: 'Marin',         zip: '94941', tags: ['vip'],                   intake_completed: true,  is_active: true,  source: 'yelp',     total_spent: 3600, visit_count: 18, last_visit: '2026-05-10', created_at: '2025-08-15' },
  { id: 'c5',  first_name: 'James',    last_name: 'Okafor',    email: 'james.okafor@gmail.com',      phone: '(415) 555-1005', city: 'Oakland',       zip: '94612', tags: ['athlete'],               intake_completed: true,  is_active: true,  source: 'instagram',total_spent: 760,  visit_count: 3,  last_visit: '2026-04-15', created_at: '2026-01-08' },
  { id: 'c6',  first_name: 'Rachel',   last_name: 'Kim',       email: 'rachel.kim@gmail.com',        phone: '(415) 555-1006', city: 'San Francisco', zip: '94114', tags: ['recurring'],             intake_completed: true,  is_active: true,  source: 'referral', total_spent: 1200, visit_count: 6,  last_visit: '2026-05-05', created_at: '2025-12-01' },
  { id: 'c7',  first_name: 'David',    last_name: 'Nguyen',    email: 'david.nguyen@startup.io',     phone: '(415) 555-1007', city: 'San Francisco', zip: '94107', tags: ['corporate', 'recurring'], intake_completed: true,  is_active: true,  source: 'website',  total_spent: 1680, visit_count: 8,  last_visit: '2026-04-30', created_at: '2025-10-22' },
  { id: 'c8',  first_name: 'Priya',    last_name: 'Sharma',    email: 'priya.sharma@gmail.com',      phone: '(415) 555-1008', city: 'Sunnyvale',     zip: '94086', tags: [],                        intake_completed: false, is_active: true,  source: 'google',   total_spent: 200,  visit_count: 1,  last_visit: '2026-05-11', created_at: '2026-05-11' },
  { id: 'c9',  first_name: 'Marcus',   last_name: 'Lee',       email: 'marcus.lee@gmail.com',        phone: '(415) 555-1009', city: 'Berkeley',      zip: '94710', tags: ['athlete'],               intake_completed: true,  is_active: true,  source: 'referral', total_spent: 920,  visit_count: 4,  last_visit: '2026-03-18', created_at: '2026-01-25' },
  { id: 'c10', first_name: 'Sofia',    last_name: 'Reyes',     email: 'sofia.reyes@gmail.com',       phone: '(415) 555-1010', city: 'San Francisco', zip: '94103', tags: ['vip', 'recurring'],      intake_completed: true,  is_active: true,  source: 'instagram',total_spent: 2800, visit_count: 14, last_visit: '2026-05-09', created_at: '2025-09-01' },
  { id: 'c11', first_name: 'Noah',     last_name: 'Green',     email: 'noah.green@gmail.com',        phone: '(415) 555-1011', city: 'San Francisco', zip: '94117', tags: [],                        intake_completed: true,  is_active: true,  source: 'website',  total_spent: 400,  visit_count: 2,  last_visit: '2026-02-12', created_at: '2026-02-01' },
  { id: 'c12', first_name: 'Amanda',   last_name: 'Torres',    email: 'amanda.torres@gmail.com',     phone: '(415) 555-1012', city: 'Marin',         zip: '94930', tags: ['recurring'],             intake_completed: true,  is_active: false, source: 'yelp',     total_spent: 580,  visit_count: 3,  last_visit: '2026-01-22', created_at: '2025-11-08' },
];

export const APPOINTMENTS = [
  // Upcoming
  { id: 'a1',  client_id: 'c8',  nurse_id: 's2', service_id: 'sv1', scheduled_at: '2026-05-11T14:00:00', status: 'confirmed',   location_address: '1042 Fulton St', location_city: 'San Francisco', location_notes: 'Apt 3B, buzz #3', clinical_notes: '', created_at: '2026-05-10' },
  { id: 'a2',  client_id: 'c4',  nurse_id: 's2', service_id: 'sv9', scheduled_at: '2026-05-11T16:30:00', status: 'scheduled',   location_address: '155 Steuart St', location_city: 'San Francisco', location_notes: 'Four Seasons, Suite 1104', clinical_notes: '', created_at: '2026-05-09' },
  { id: 'a3',  client_id: 'c6',  nurse_id: 's3', service_id: 'sv2', scheduled_at: '2026-05-12T10:00:00', status: 'scheduled',   location_address: '820 Castro St',  location_city: 'San Francisco', location_notes: 'Home visit, dogs inside', clinical_notes: '', created_at: '2026-05-10' },
  { id: 'a4',  client_id: 'c1',  nurse_id: 's3', service_id: 'sv5', scheduled_at: '2026-05-12T13:00:00', status: 'confirmed',   location_address: '188 King St',    location_city: 'San Francisco', location_notes: 'Apt 2205', clinical_notes: '', created_at: '2026-05-08' },
  { id: 'a5',  client_id: 'c7',  nurse_id: 's2', service_id: 'sv1', scheduled_at: '2026-05-13T09:00:00', status: 'scheduled',   location_address: '270 Brannan St', location_city: 'San Francisco', location_notes: 'Office lobby, ask for David', clinical_notes: '', created_at: '2026-05-10' },
  { id: 'a6',  client_id: 'c10', nurse_id: 's3', service_id: 'sv3', scheduled_at: '2026-05-13T15:00:00', status: 'scheduled',   location_address: '500 Florida St', location_city: 'San Francisco', location_notes: '', clinical_notes: '', created_at: '2026-05-11' },
  // Completed
  { id: 'a7',  client_id: 'c4',  nurse_id: 's2', service_id: 'sv1', scheduled_at: '2026-05-10T11:00:00', status: 'completed',   location_address: '155 Steuart St', location_city: 'San Francisco', location_notes: 'Four Seasons, Suite 1104', clinical_notes: 'Patient tolerated infusion well. No adverse reactions. Requested follow-up NAD+ next week.', created_at: '2026-05-08' },
  { id: 'a8',  client_id: 'c1',  nurse_id: 's3', service_id: 'sv2', scheduled_at: '2026-05-08T13:30:00', status: 'completed',   location_address: '188 King St',    location_city: 'San Francisco', location_notes: 'Apt 2205', clinical_notes: 'Client requested slower infusion rate. Completed in 95 min. No issues.', created_at: '2026-05-07' },
  { id: 'a9',  client_id: 'c2',  nurse_id: 's2', service_id: 'sv1', scheduled_at: '2026-05-08T10:00:00', status: 'completed',   location_address: '3388 22nd St',   location_city: 'San Francisco', location_notes: '', clinical_notes: 'Routine. Client feeling much better post-infusion.', created_at: '2026-05-06' },
  { id: 'a10', client_id: 'c10', nurse_id: 's3', service_id: 'sv9', scheduled_at: '2026-05-07T14:00:00', status: 'completed',   location_address: '500 Florida St', location_city: 'San Francisco', location_notes: '', clinical_notes: 'VIP package delivered. Client in great spirits.', created_at: '2026-05-05' },
  { id: 'a11', client_id: 'c3',  nurse_id: 's2', service_id: 'sv5', scheduled_at: '2026-05-06T09:00:00', status: 'completed',   location_address: '3000 El Camino', location_city: 'Palo Alto',     location_notes: 'Office visit', clinical_notes: 'Pre-game protocol. Client very satisfied.', created_at: '2026-05-04' },
  { id: 'a12', client_id: 'c9',  nurse_id: 's3', service_id: 'sv4', scheduled_at: '2026-05-05T16:00:00', status: 'cancelled',   location_address: '2345 Telegraph', location_city: 'Berkeley',      location_notes: '', clinical_notes: '', created_at: '2026-05-04' },
];

export const INVOICES = [
  { id: 'i1', invoice_number: 'AV-0041', client_id: 'c8',  appointment_id: 'a1',  subtotal: 200, tax: 0, discount: 0,  total: 200,  status: 'draft',    payment_method: null,   paid_at: null,              notes: '',                   created_at: '2026-05-11' },
  { id: 'i2', invoice_number: 'AV-0040', client_id: 'c4',  appointment_id: 'a7',  subtotal: 200, tax: 0, discount: 0,  total: 200,  status: 'paid',     payment_method: 'card', paid_at: '2026-05-10T13:00Z', notes: 'Autopay on file.',  created_at: '2026-05-10' },
  { id: 'i3', invoice_number: 'AV-0039', client_id: 'c1',  appointment_id: 'a8',  subtotal: 280, tax: 0, discount: 20, total: 260,  status: 'paid',     payment_method: 'venmo',paid_at: '2026-05-08T16:00Z', notes: 'Member discount $20.', created_at: '2026-05-08' },
  { id: 'i4', invoice_number: 'AV-0038', client_id: 'c2',  appointment_id: 'a9',  subtotal: 200, tax: 0, discount: 0,  total: 200,  status: 'paid',     payment_method: 'zelle',paid_at: '2026-05-08T11:30Z', notes: '',                   created_at: '2026-05-08' },
  { id: 'i5', invoice_number: 'AV-0037', client_id: 'c10', appointment_id: 'a10', subtotal: 450, tax: 0, discount: 50, total: 400,  status: 'paid',     payment_method: 'card', paid_at: '2026-05-07T15:00Z', notes: 'VIP package + loyalty discount.', created_at: '2026-05-07' },
  { id: 'i6', invoice_number: 'AV-0036', client_id: 'c3',  appointment_id: 'a11', subtotal: 220, tax: 0, discount: 0,  total: 220,  status: 'paid',     payment_method: 'card', paid_at: '2026-05-06T10:00Z', notes: 'Corporate billing.', created_at: '2026-05-06' },
  { id: 'i7', invoice_number: 'AV-0035', client_id: 'c7',  appointment_id: null,  subtotal: 200, tax: 0, discount: 0,  total: 200,  status: 'overdue',  payment_method: null,   paid_at: null,              notes: 'Follow up re: payment.', created_at: '2026-04-28' },
  { id: 'i8', invoice_number: 'AV-0034', client_id: 'c6',  appointment_id: null,  subtotal: 280, tax: 0, discount: 20, total: 260,  status: 'sent',     payment_method: null,   paid_at: null,              notes: 'Member rate applied.', created_at: '2026-05-05' },
];

export const EXPENSES = [
  { id: 'e1', category: 'supplies',   description: 'IV bags + tubing (48-pack)',   amount: 312,  vendor: 'Bound Tree Medical', date: '2026-05-01', receipt_url: null },
  { id: 'e2', category: 'supplies',   description: 'NAD+ powder (10g)',             amount: 480,  vendor: 'Revive MD',          date: '2026-05-03', receipt_url: null },
  { id: 'e3', category: 'supplies',   description: 'Glutathione 200mg vials (20)', amount: 290,  vendor: 'Olympia Pharmacy',   date: '2026-05-03', receipt_url: null },
  { id: 'e4', category: 'marketing',  description: 'Instagram ads — May',          amount: 400,  vendor: 'Meta',               date: '2026-05-01', receipt_url: null },
  { id: 'e5', category: 'insurance',  description: 'Malpractice premium Q2',       amount: 1200, vendor: 'CM&F Group',         date: '2026-04-01', receipt_url: null },
  { id: 'e6', category: 'supplies',   description: 'Vitamin C 50ml vials (50)',    amount: 175,  vendor: 'Olympia Pharmacy',   date: '2026-04-28', receipt_url: null },
  { id: 'e7', category: 'travel',     description: 'Nurse mileage reimbursement',  amount: 210,  vendor: 'Internal',           date: '2026-05-10', receipt_url: null },
  { id: 'e8', category: 'other',      description: 'Acuity Scheduling subscription', amount: 25, vendor: 'Acuity',             date: '2026-05-01', receipt_url: null },
];

export const ACTIVITY_LOG = [
  { id: 'al1',  entity_type: 'appointment', entity_id: 'a1',  action: 'status_changed', details: { from: 'scheduled', to: 'confirmed' },  performed_by: 's1', created_at: '2026-05-11T08:10:00Z' },
  { id: 'al2',  entity_type: 'client',      entity_id: 'c8',  action: 'created',         details: { name: 'Priya Sharma' },               performed_by: 's1', created_at: '2026-05-11T07:55:00Z' },
  { id: 'al3',  entity_type: 'invoice',     entity_id: 'i2',  action: 'status_changed', details: { from: 'sent', to: 'paid' },            performed_by: 's2', created_at: '2026-05-10T13:01:00Z' },
  { id: 'al4',  entity_type: 'appointment', entity_id: 'a7',  action: 'status_changed', details: { from: 'in_progress', to: 'completed' }, performed_by: 's2', created_at: '2026-05-10T12:45:00Z' },
  { id: 'al5',  entity_type: 'invoice',     entity_id: 'i3',  action: 'status_changed', details: { from: 'sent', to: 'paid' },            performed_by: 's3', created_at: '2026-05-08T16:02:00Z' },
  { id: 'al6',  entity_type: 'appointment', entity_id: 'a8',  action: 'status_changed', details: { from: 'in_progress', to: 'completed' }, performed_by: 's3', created_at: '2026-05-08T15:50:00Z' },
  { id: 'al7',  entity_type: 'client',      entity_id: 'c9',  action: 'updated',         details: { field: 'tags', value: 'athlete' },     performed_by: 's1', created_at: '2026-05-07T11:20:00Z' },
  { id: 'al8',  entity_type: 'invoice',     entity_id: 'i5',  action: 'status_changed', details: { from: 'sent', to: 'paid' },            performed_by: 's1', created_at: '2026-05-07T15:01:00Z' },
  { id: 'al9',  entity_type: 'expense',     entity_id: 'e7',  action: 'created',         details: { amount: 210, category: 'travel' },     performed_by: 's1', created_at: '2026-05-10T09:00:00Z' },
  { id: 'al10', entity_type: 'appointment', entity_id: 'a12', action: 'status_changed', details: { from: 'scheduled', to: 'cancelled' },  performed_by: 's1', created_at: '2026-05-05T14:00:00Z' },
];

// ── Computed helpers ───────────────────────────────────────────────────────────

export function getClient(id)      { return CLIENTS.find(c => c.id === id); }
export function getStaff(id)       { return STAFF.find(s => s.id === id); }
export function getService(id)     { return SERVICES.find(s => s.id === id); }

export function getClientName(id) {
  const c = getClient(id);
  return c ? `${c.first_name} ${c.last_name}` : '—';
}
export function getStaffName(id) {
  const s = getStaff(id);
  return s ? `${s.first_name} ${s.last_name}` : '—';
}
export function getServiceName(id) {
  const s = getService(id);
  return s ? s.name : '—';
}

export function formatCurrency(n) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

export function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

// Dashboard stats
export function getDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const thisMonthRevenue = INVOICES
    .filter(i => i.status === 'paid' && new Date(i.created_at) >= startOfMonth)
    .reduce((sum, i) => sum + i.total, 0);

  const lastMonthRevenue = INVOICES
    .filter(i => i.status === 'paid' && new Date(i.created_at) >= startOfLastMonth && new Date(i.created_at) <= endOfLastMonth)
    .reduce((sum, i) => sum + i.total, 0);

  const revenueChange = lastMonthRevenue > 0
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : 0;

  const weekAgo = new Date(now - 7 * 86400000);
  const apptThisWeek = APPOINTMENTS.filter(a => new Date(a.scheduled_at) >= weekAgo);

  const outstanding = INVOICES.filter(i => ['sent', 'overdue', 'draft'].includes(i.status));
  const outstandingTotal = outstanding.reduce((sum, i) => sum + i.total, 0);

  const newClientsThisMonth = CLIENTS.filter(c => new Date(c.created_at) >= startOfMonth).length;

  return {
    thisMonthRevenue,
    lastMonthRevenue,
    revenueChange,
    apptThisWeek: apptThisWeek.length,
    apptCompleted: apptThisWeek.filter(a => a.status === 'completed').length,
    apptCancelled: apptThisWeek.filter(a => a.status === 'cancelled').length,
    newClientsThisMonth,
    outstandingCount: outstanding.length,
    outstandingTotal,
  };
}

export function getUpcomingAppointments() {
  const now = new Date();
  return APPOINTMENTS
    .filter(a => new Date(a.scheduled_at) >= now && ['scheduled', 'confirmed', 'in_progress'].includes(a.status))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 8);
}

// Revenue by month (last 6 months)
export function getMonthlyRevenue() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const rev = INVOICES
      .filter(inv => inv.status === 'paid' && new Date(inv.created_at) >= start && new Date(inv.created_at) <= end)
      .reduce((sum, inv) => sum + inv.total, 0);
    months.push({ label, rev });
  }
  return months;
}
