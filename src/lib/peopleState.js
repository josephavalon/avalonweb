/**
 * Person-state helpers shared by /book (one-time) and /subscription (plan).
 * Each "person" on an order has their own therapy + add-ons + IM shots.
 * Cap = 4 (house-call group ceiling).
 */

export const PEOPLE_MAX = 4;

export function createPerson(index = 0) {
  return {
    id: `p${index + 1}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    dob: '',
    productKey: '',
    addOns: [],
    // /plans-specific fields — harmless when unused by /book.
    categoryKey: '',
    therapyKey: '',
    ivQty: {},
    imQty: {},
  };
}

export function ensureAtLeastOne(people) {
  if (Array.isArray(people) && people.length > 0) return people;
  return [createPerson(0)];
}

export function addPerson(people) {
  const list = ensureAtLeastOne(people);
  if (list.length >= PEOPLE_MAX) return list;
  return [...list, createPerson(list.length)];
}

export function removePerson(people, id) {
  const list = ensureAtLeastOne(people);
  const next = list.filter((p) => p.id !== id);
  return ensureAtLeastOne(next);
}

export function updatePerson(people, id, patch) {
  const list = ensureAtLeastOne(people);
  return list.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

export function findPerson(people, id) {
  const list = ensureAtLeastOne(people);
  return list.find((p) => p.id === id) || list[0];
}

export function personLabel(person, index, override) {
  const name = String(person?.name || '').trim();
  if (name) return name;
  if (override) return override;
  return `Person ${index + 1}`;
}

/**
 * The # of people that actually have an IV picked. Used for deposit math —
 * an empty person tab shouldn't bill an extra $50.
 */
export function billablePeopleCount(people) {
  const list = ensureAtLeastOne(people);
  const filled = list.filter((p) => Boolean(p.productKey || p.therapyKey)).length;
  return Math.max(1, filled);
}

/**
 * Migrate a legacy flat booking state (productKey + addOns at the top level)
 * into the new people[] shape. Safe to call on already-migrated state.
 */
export function migrateLegacyBookingState(state) {
  if (!state || typeof state !== 'object') return state;
  if (Array.isArray(state.people) && state.people.length > 0) return state;
  const legacy = createPerson(0);
  if (state.productKey) legacy.productKey = state.productKey;
  if (Array.isArray(state.addOns)) legacy.addOns = state.addOns;
  if (state.name) legacy.name = state.name;
  if (state.dob) legacy.dob = state.dob;
  return {
    ...state,
    people: [legacy],
    activePersonId: legacy.id,
  };
}
