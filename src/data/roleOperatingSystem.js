export const FEATURE_STATUS = {
  live: 'Live',
  staged: 'Staged',
  next: 'Next',
};

const liveRoutes = {
  Queue: '/provider/shift',
  Scan: '/provider/role-os?focus=scan',
  Visits: '/provider/shift',
  'Infusion Command': '/provider/shift',
  Broadcast: '/provider/communications',
  Home: '/provider/dashboard',
  'Schedule / route view': '/provider/dashboard',
  Messages: '/provider/communications',
  Inventory: '/admin/inventory',
  'Mileage log': '/provider/dashboard',
  Dispatch: '/provider/appointments',
  Routing: '/provider/dashboard',
  Protocols: '/protocols',
  'GFE Management': '/provider/invoicing',
  'GFE Mgmt': '/provider/invoicing',
  'MD Approvals': '/provider/invoicing',
  Payments: '/provider/accounting',
  Payroll: '/provider/accounting',
  Services: '/provider/services',
  Memberships: '/subscription',
  Dashboard: '/admin',
  Command: '/admin',
  Requests: '/provider/appointments',
  Clients: '/provider/clients',
  Nurses: '/provider/staff',
  Reports: '/provider/reports',
  Settings: '/provider/settings',
  'Event Planner': '/launches',
};

function feature(label, description, status = FEATURE_STATUS.staged, route = '') {
  return {
    label,
    description,
    status,
    route: route || liveRoutes[label] || '',
  };
}

export const RN_SERVICE_MODE = [
  feature('Queue', 'Claim and work the live patient queue.', FEATURE_STATUS.live),
  feature('Scan', 'QR and barcode treatment scanner.', FEATURE_STATUS.next),
  feature('Visits', 'Visit status, field execution, and Acuity closeout.', FEATURE_STATUS.live),
  feature('Infusion Command', 'Start, pause, resume, and complete treatment timers.', FEATURE_STATUS.live),
  feature('Field Swap', 'Request or accept shift swaps in the field.', FEATURE_STATUS.staged),
  feature('Drug Interaction Check', 'Medication and protocol safety check before treatment.', FEATURE_STATUS.next),
  feature('Clinical Protocols viewer', 'View-only clinical protocols and standing-order references.', FEATURE_STATUS.staged, '/protocols'),
  feature('Broadcast', 'Receive ops broadcasts and assignment alerts.', FEATURE_STATUS.live),
  feature('Nurse Inventory Map', 'Locate kits and supplies across nearby nurses.', FEATURE_STATUS.staged),
];

export const NURSE_HOME_MODE = [
  feature('Home', 'Nurse dashboard and shift readiness.', FEATURE_STATUS.live),
  feature('Schedule / route view', 'Route preview with Apple and Google Maps links.', FEATURE_STATUS.live),
  feature('Messages', 'Avalon Comms for group threads, announcements, alerts, and Y/N shift replies.', FEATURE_STATUS.live),
  feature('Visits', 'Today queue and historical visit records.', FEATURE_STATUS.live),
  feature('Inventory', 'Assigned inventory and kit visibility.', FEATURE_STATUS.live),
  feature('HR portal', 'HR and policy access.', FEATURE_STATUS.staged),
  feature('My Portal', 'Nurse self-service profile and preferences.', FEATURE_STATUS.staged),
  feature('Clinical -> Dispatch', 'Clinical dispatch board.', FEATURE_STATUS.live, '/provider/appointments'),
  feature('Clinical -> Routing', 'Route preview and stop sequencing.', FEATURE_STATUS.live, '/provider/dashboard'),
  feature('Clinical -> Infusion Command', 'Infusion controls inside visit execution.', FEATURE_STATUS.live, '/provider/shift'),
  feature('Clinical -> Drug Check', 'Drug interaction and contraindication checkpoint.', FEATURE_STATUS.next),
  feature('Clinical -> Protocols', 'Protocol library and treatment references.', FEATURE_STATUS.staged, '/protocols'),
  feature('Operations -> Inventory', 'Inventory status and kit lookup.', FEATURE_STATUS.live, '/admin/inventory'),
  feature('Operations -> Kits', 'Kit packing and replenishment.', FEATURE_STATUS.staged),
  feature('Operations -> Mileage log', 'Personal mileage logging for payroll proof.', FEATURE_STATUS.live, '/provider/dashboard'),
  feature('Operations -> Field Exceptions', 'Incident and exception escalation.', FEATURE_STATUS.staged),
  feature('Operations -> Shift Swap', 'Request, accept, and track swaps.', FEATURE_STATUS.staged),
];

export const STANDALONE_NURSE_APPS = [
  feature('Nurse Station', 'Queue board, my patients, vitals, profile, claim/start/complete/release/escalate, shift ready check, live timers.', FEATURE_STATUS.live, '/provider/shift'),
  feature('QR Scanner', 'Badge scan, patient QR, visit lookup, patient card, treatment timer, complete and reset workflow.', FEATURE_STATUS.next, '/provider/role-os?focus=qr'),
  feature('Patient Intake', 'Nurse-supervised iPad wizard with history, allergies, emergency contact, treatment, consents, signature, QR confirmation, offline restore.', FEATURE_STATUS.staged, '/book'),
];

export const AUTHORITY_MODE = [
  feature('MD Approvals queue', 'Clinical approvals and clearance queue for NP/MD authority.', FEATURE_STATUS.live, '/provider/invoicing'),
  feature('GFE Management', 'Good Faith Exam tracker and routing state.', FEATURE_STATUS.live, '/provider/invoicing'),
  feature('Async MD Review', 'Remote review queue for asynchronous clinical decisions.', FEATURE_STATUS.staged),
  feature('Standing Orders authoring/approval', 'Author and approve standing orders.', FEATURE_STATUS.staged, '/medical-direction'),
  feature('MD Failover coverage', 'Fallback coverage routing when no Avalon NP is on call.', FEATURE_STATUS.live, '/provider/communications'),
  feature('Clinical Protocols approval', 'Approval mode beyond RN view-only protocols.', FEATURE_STATUS.staged, '/protocols'),
];

export const DISPATCH_MODE = [
  feature('Dispatch board', 'Ops view of requests, clearance, and assignment.', FEATURE_STATUS.live, '/provider/appointments'),
  feature('Predictive Dispatch', 'Forecast demand and staff ahead of spikes.', FEATURE_STATUS.staged),
  feature('Routing optimization', 'Route and stop optimization.', FEATURE_STATUS.live, '/provider/dashboard'),
  feature('Surge Control', 'Surge monitoring and capacity triggers.', FEATURE_STATUS.staged),
  feature('Scheduling', 'Schedules, shift templates, and booking visibility.', FEATURE_STATUS.live, '/provider/appointments'),
  feature('Shift Templates', 'Reusable staffing templates.', FEATURE_STATUS.staged),
  feature('Event Planner', 'Venue, festival, and presale planning.', FEATURE_STATUS.live),
  feature('Live Map', 'Field map with nurse and appointment state.', FEATURE_STATUS.staged),
  feature('Supply Request', 'Nurse supply requests and approvals.', FEATURE_STATUS.staged),
  feature('Field Exceptions', 'Exception triage and incident routing.', FEATURE_STATUS.staged),
  feature('Broadcast messaging', 'SMS, in-app, and email dispatch blasts.', FEATURE_STATUS.live, '/provider/communications'),
  feature('Capacity + Throughput modeling', 'Capacity and throughput forecasting.', FEATURE_STATUS.staged),
];

export const FOUNDER_GROUPS = [
  {
    title: 'Primary',
    items: ['Dashboard', 'Queue', 'Pipeline', 'Schedule', 'Messages', 'Patients', 'Incidents'],
  },
  {
    title: 'Clinical Care',
    items: ['Dispatch', 'Predictive Dispatch', 'Routing', 'Zero-Friction', 'CDS Alerts', 'Playbooks', 'Quality', 'MD Approvals', 'Lifecycle', 'Consents', 'Infusion Command', 'Adverse Events', 'Group Visit', 'Venous Access / Stick Map', 'Drug Interactions', 'Protocols', 'Care Plans', 'Async MD Review', 'MD Failover', 'Mission Packet', 'Inventory Recon', 'Haptic Metronome', 'Outcome Tracking'],
  },
  {
    title: 'Operations',
    items: ['Inventory', 'Kits', 'Tasks', 'Checklists', 'Assets', 'Locations', 'Command', 'Live Map', 'Doc Vault', 'Mileage', 'Field Safety', 'Field Intel', 'Supply Request', 'Field Swap', 'GPS Safety', 'QR Codes', 'Kit Deduction', 'Supply Chain', 'Office-in-a-Box', 'Cancellations', 'Follow-Ups', 'Shift Swap', 'Service Heatmap', 'Broadcast', 'Nurse Inv Map', 'Shift Templates', 'Event Planner', 'Throughput Model', 'Post-Event Learning', 'Surge Control', 'Offline Ops', 'iPad Command', 'Launch Playbook', 'Ghost Training', 'Hardware Sentinel', 'Archive & Prune', 'Degraded Mode'],
  },
  {
    title: 'Compliance & Risk',
    items: ['Compliance', 'HIPAA', 'Audit Log', 'Controlled Substances', 'GFE Mgmt', 'Exceptions', 'Field Exceptions', 'Audit Trail', 'Lockouts', 'Exception Ops', 'Notification Rules', 'Nursys', 'Credentialing', 'Scope Matrix', 'Provider Risk Scoring', 'Safety Auth', 'Fatigue', 'Patient Verify', 'Standing Orders', 'State Compliance', 'Biometric Sign'],
  },
  {
    title: 'Finance & Billing',
    items: ['Finance', 'Payments', 'Invoices', 'Services', 'Memberships', 'Payroll', 'Yield Mgmt', 'Broker Portal', 'Revenue Leakage'],
  },
  {
    title: 'People & HR',
    items: ['Providers', 'HR Portal', 'Workforce', 'Capacity', 'Performance Reviews', 'Training Gates', 'Competency', 'Team Directory', 'Onboarding'],
  },
  {
    title: 'Analytics & Insights',
    items: ['Analytics', 'Forecasting', 'Visit Economics', 'Unit Economics', 'Econ Intel', 'Patient Experience', 'SLA Tracker', 'CX Cases', 'Surveys / NPS', 'Reports', 'Investor', 'Launches', 'Investor Report', 'Pulse View', 'Flow Rate', 'Performance Pay'],
  },
  {
    title: 'Architecture & Systems',
    items: ['Panel Virtualization', 'DB Shards', 'Flight Recorder'],
  },
  {
    title: 'Quick Actions',
    items: ['My Profile', 'Settings'],
  },
  {
    title: 'Contextual Modules',
    items: ['AI Scribe', 'Device Calibration', 'Clinical Safety', 'Cold-Chain Monitoring', 'Custody Transfers', 'Device Mode', 'Activity Feed', 'Fleet', 'Global Command', 'Hardware Heartbeat', 'Inventory Images', 'Lab Manifests', 'Ops Exceptions', 'Patient Portal', 'Peer Review', 'Clinical Protocols', 'Stories', 'Strategic Intel', 'Telehealth', 'Waste Logs', 'Workforce Intel'],
  },
].map((group) => ({
  ...group,
  features: group.items.map((item) => feature(item, `${item} module`, liveRoutes[item] ? FEATURE_STATUS.live : FEATURE_STATUS.staged, liveRoutes[item])),
}));

export const ROLE_OPERATING_SYSTEM = [
  {
    id: 'rn-service',
    role: 'RN',
    mode: 'Service Mode',
    summary: 'In-field execution, fast claim, safe treatment, compliant close.',
    features: RN_SERVICE_MODE,
  },
  {
    id: 'nurse-home',
    role: 'RN',
    mode: 'Nurse Mode',
    summary: 'Home base for schedule, routes, messages, inventory, mileage, and field ops.',
    features: NURSE_HOME_MODE,
  },
  {
    id: 'standalone-nurse',
    role: 'RN',
    mode: 'Standalone Apps',
    summary: 'Purpose-built nurse station, scanner, and iPad intake experiences.',
    features: STANDALONE_NURSE_APPS,
  },
  {
    id: 'authority',
    role: 'NP / MD',
    mode: 'Clinical Authority',
    summary: 'GFE, approvals, standing orders, failover, and protocol authority.',
    features: AUTHORITY_MODE,
  },
  {
    id: 'dispatch',
    role: 'Ops',
    mode: 'Dispatch',
    summary: 'Live operations, routing, staffing, exceptions, and capacity control.',
    features: DISPATCH_MODE,
  },
];

export function countFounderPanels() {
  return FOUNDER_GROUPS.reduce((total, group) => total + group.features.length, 0);
}

export function countLiveFeatures(groups = ROLE_OPERATING_SYSTEM) {
  return groups.reduce((total, group) => total + group.features.filter((item) => item.status === FEATURE_STATUS.live).length, 0);
}
