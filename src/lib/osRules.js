const HIGH_RISK_TERMS = ['nad', 'exosome', 'group', 'event', 'high dose', 'cbd'];

export function buildBookingTimeline({ intake = false, cleared = false, nurse = false, paid = false, enRoute = false, complete = false } = {}) {
  return [
    { key: 'request', label: 'Request received', done: true },
    { key: 'intake', label: 'Intake reviewed', done: intake },
    { key: 'clearance', label: 'Clinical clearance', done: cleared },
    { key: 'nurse', label: 'Nurse assigned', done: nurse },
    { key: 'payment', label: 'Payment ready', done: paid },
    { key: 'route', label: 'RN en route', done: enRoute },
    { key: 'complete', label: 'Visit complete', done: complete },
  ];
}

export function recommendProtocol({ goal, budget = 250, time = 60, symptoms = '' } = {}, sessions = []) {
  const text = `${goal || ''} ${symptoms}`.toLowerCase();
  const scored = sessions.map((session) => {
    const haystack = `${session.key} ${session.label} ${session.tagline || ''} ${session.category || ''}`.toLowerCase();
    let score = 0;
    if (goal && haystack.includes(String(goal).toLowerCase())) score += 4;
    if (text.includes('tired') || text.includes('energy')) score += haystack.includes('energy') || haystack.includes('nad') ? 3 : 0;
    if (text.includes('sick') || text.includes('immune')) score += haystack.includes('immune') || haystack.includes('vitamin c') ? 3 : 0;
    if (text.includes('travel') || text.includes('hangover') || text.includes('recovery')) score += haystack.includes('recovery') || haystack.includes('hydration') ? 3 : 0;
    const price = session.doses?.[0]?.price ?? session.price ?? 0;
    if (price <= budget) score += 2;
    if ((session.duration || 60) <= time) score += 1;
    if (session.key === 'myers') score += 1;
    return { session, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map((entry) => entry.session);
}

export function scoreRequestRisk(req) {
  const issues = [];
  if (['Pending', 'Not Started'].includes(req.intake)) issues.push({ severity: 3, label: 'Intake missing' });
  if (['Pending', 'Not Started'].includes(req.consent)) issues.push({ severity: 3, label: 'Consent missing' });
  if (req.gfe !== 'Cleared') issues.push({ severity: 3, label: 'Clinical clearance needed' });
  if (!req.nurse || req.nurse === 'Unassigned') issues.push({ severity: 2, label: 'No nurse assigned' });
  if (req.payment !== 'Paid' && req.payment !== 'Invoice') issues.push({ severity: 2, label: 'Payment not ready' });
  if (Number(req.guests) > 4) issues.push({ severity: 3, label: 'Group staffing needed' });
  const protocol = `${req.therapy || ''} ${(req.addOns || []).join(' ')}`.toLowerCase();
  if (HIGH_RISK_TERMS.some((term) => protocol.includes(term))) issues.push({ severity: 1, label: 'Review protocol details' });
  return {
    score: issues.reduce((sum, issue) => sum + issue.severity, 0),
    issues,
    level: issues.some((issue) => issue.severity >= 3) ? 'critical' : issues.length ? 'watch' : 'ready',
  };
}

export function buildAdminRisks(requests = [], inventory = []) {
  const scored = requests.map((request) => ({ request, risk: scoreRequestRisk(request) }));
  const critical = scored.filter((item) => item.risk.level === 'critical').length;
  const unassigned = requests.filter((request) => !request.nurse || request.nurse === 'Unassigned').length;
  const payment = requests.filter((request) => request.payment && !['Paid', 'Invoice'].includes(request.payment)).length;
  const stock = inventory.filter((item) => /low|restock|expiry/i.test(item.status || '')).length;
  return [
    { label: 'Clinical clearance', detail: `${critical} visits blocked`, level: critical ? 'red' : 'gold' },
    { label: 'Nurse assignment', detail: `${unassigned} unassigned`, level: unassigned ? 'red' : 'gold' },
    { label: 'Payments', detail: `${payment} pending`, level: payment ? 'amber' : 'gold' },
    { label: 'Inventory', detail: `${stock} supply alerts`, level: stock ? 'amber' : 'gold' },
  ];
}

export function deductVisitInventory(inventory = [], visit = {}) {
  const therapy = String(visit.therapy || visit.service || '').toLowerCase();
  return inventory.map((item) => {
    const next = { ...item };
    if (/iv bags/i.test(item.name)) next.quantity = Math.max(0, Number(item.quantity || 12) - 1);
    if (therapy.includes('nad') && /nad/i.test(item.name)) next.quantity = Math.max(0, Number(item.quantity || 8) - 1);
    if (therapy.includes('vitamin c') && /vitamin c/i.test(item.name)) next.quantity = Math.max(0, Number(item.quantity || 3) - 1);
    if (next.quantity <= 3 && next.quantity !== undefined) next.status = 'Restock Needed';
    return next;
  });
}

export function matchServiceArea(input = '', zones = [], coveredZips) {
  const query = String(input).trim().toLowerCase();
  const cleanZip = query.replace(/\D/g, '').slice(0, 5);
  if (cleanZip.length === 5 && coveredZips?.has(cleanZip)) {
    return { status: 'covered', label: cleanZip, window: 'Same-day or next-day', zone: 'Covered Bay Area ZIP' };
  }
  for (const zone of zones) {
    const area = zone.areas.find((name) => name.toLowerCase() === query || name.toLowerCase().includes(query));
    if (area) return { status: 'covered', label: area, window: zone.region === 'San Francisco' ? 'Often same-day' : 'Same-day when nurses are nearby', zone: zone.region };
  }
  return { status: cleanZip.length === 5 ? 'not_covered' : 'unknown', label: input, window: 'Contact us to confirm', zone: null };
}

