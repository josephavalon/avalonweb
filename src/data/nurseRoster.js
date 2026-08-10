/**
 * The invoice roster — mirrors the paid contractors in Gusto (People → Active).
 *
 * Roles come straight from their Gusto job titles. They label the invoice; since
 * 2026-08-10 they no longer gate anything, GFE included.
 * Corey Assibey (CFO) and Aaron Goldbard (Head of Workforce Relations) are
 * marked Unpaid in Gusto and are deliberately absent.
 *
 * Pure module — imported by the page AND by api/invoice/submit.js, which resolves
 * the role from HERE rather than trusting the request body. Keep it free of
 * aliases and browser globals.
 *
 * No email addresses: this file ships inside a publicly fetchable JS chunk, and
 * the invoice always goes to the three fixed internal addresses, so putting
 * staff emails here would publish a contact list for no functional gain.
 */

export const NURSE_ROSTER = Object.freeze([
  Object.freeze({ id: 'angela-solleder', name: 'Angela Solleder', role: 'NP' }),
  Object.freeze({ id: 'anna-holder', name: 'Anna Holder', role: 'RN' }),
  Object.freeze({ id: 'judy-yonai', name: 'Judy Yonai', role: 'RN' }),
  Object.freeze({ id: 'kara-lee', name: 'Kara Lee', role: 'RN' }),
  Object.freeze({ id: 'mateya-whyte', name: 'Mateya Whyte', role: 'RN' }),
  Object.freeze({ id: 'robert-sloan', name: 'Robert Sloan', role: 'RN' }),
  Object.freeze({ id: 'rowieh-schabert', name: 'Rowieh Schabert', role: 'RN' }),
  Object.freeze({ id: 'stephanie-weeks', name: 'Stephanie Weeks', role: 'Manager' }),
  Object.freeze({ id: 'thomas-collery', name: 'Thomas Collery', role: 'RN' }),
  Object.freeze({ id: 'tiffany-ward', name: 'Tiffany Ward', role: 'NP' }),
]);

export function findNurse(id) {
  return NURSE_ROSTER.find((nurse) => nurse.id === id) || null;
}

/** "  tiffany   WARD " -> "tiffany ward" */
export function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The name is typed, not picked, so this is how an invoice is tied back to a
 * known contractor — for the role label and for Gusto, which pays a person, not
 * a string. An unmatched name still invoices; it just carries no role.
 */
export function matchNurseByName(name) {
  const wanted = normalizeName(name);
  if (!wanted) return null;
  return NURSE_ROSTER.find((nurse) => normalizeName(nurse.name) === wanted) || null;
}

/**
 * A label only, since GFE opened up to everyone — role no longer affects pay.
 * Empty for a name nobody recognises, so an invoice never asserts a credential
 * that was never checked.
 */
export function roleForName(name) {
  return matchNurseByName(name)?.role || '';
}

/** "Tiffany Ward" -> "TW". Used to build the invoice number Gusto files under. */
export function nurseInitials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase())
    .join('')
    .slice(0, 3);
}
