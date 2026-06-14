import { appendActivity, readLocal, writeLocal } from './localOs.js';

const KEY = 'ops.quickPatients';

function splitName(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
}

export function formatPatientName(patient = {}) {
  return patient.name || [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'New patient';
}

export function readQuickPatients(limit = 50) {
  const rows = readLocal(KEY, []);
  return Array.isArray(rows) ? rows.slice(0, limit) : [];
}

export function addQuickPatient(input = {}, context = {}) {
  const fullName = String(input.name || '').trim();
  const { firstName, lastName } = splitName(fullName);
  const now = new Date().toISOString();
  const patient = {
    id: `patient-${Date.now()}`,
    name: fullName,
    firstName,
    lastName,
    email: String(input.email || '').trim(),
    phone: String(input.phone || '').trim(),
    city: String(input.city || '').trim(),
    zip: String(input.zip || '').trim(),
    service: input.service || context.service || 'Protocol pending',
    source: input.source || context.source || context.portal || 'Avalon OS',
    note: String(input.note || '').trim(),
    status: 'Needs intake',
    intakeStatus: 'Needed',
    gfeStatus: 'Annual GFE check needed',
    scheduleStatus: context.eventId ? 'Event roster' : 'Not scheduled',
    portal: context.portal || 'ops',
    eventId: context.eventId || '',
    eventName: context.eventName || '',
    createdAt: now,
    updatedAt: now,
  };
  const current = readQuickPatients(100);
  writeLocal(KEY, [patient, ...current].slice(0, 100));
  appendActivity(`New patient added: ${formatPatientName(patient)}`, {
    role: context.portal || 'ops',
    patientId: patient.id,
    eventId: patient.eventId,
    source: patient.source,
  });
  return patient;
}

export function patientToClientShape(patient = {}) {
  return {
    id: patient.id,
    first_name: patient.firstName || splitName(patient.name).firstName || 'New',
    last_name: patient.lastName || splitName(patient.name).lastName || 'Patient',
    email: patient.email || '',
    phone: patient.phone || '',
    city: patient.city || '',
    zip: patient.zip || '',
    tags: patient.eventId ? ['event'] : ['new'],
    intake_completed: false,
    is_active: true,
    source: patient.source || 'Avalon OS',
    total_spent: 0,
    visit_count: 0,
    last_visit: null,
    created_at: (patient.createdAt || new Date().toISOString()).slice(0, 10),
  };
}

export function patientToAppointmentPreview(patient = {}) {
  return {
    id: patient.id,
    firstName: patient.firstName || splitName(patient.name).firstName || 'New',
    lastName: patient.lastName || splitName(patient.name).lastName || 'Patient',
    type: patient.service || 'Protocol pending',
    datetime: new Date().toISOString(),
    duration: 60,
    location: [patient.city || 'Location pending', patient.zip].filter(Boolean).join(' '),
    email: patient.email || '',
    phone: patient.phone || '',
    price: 0,
    notes: patient.note || 'Quick-add patient. Complete intake, scheduling, GFE, and payment before dispatch.',
  };
}
