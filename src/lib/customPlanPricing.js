import { IV_ADDONS } from '../data/catalog/iv-addons.js';
import { IM_SHOTS } from '../data/catalog/im-shots.js';
import { IV_SESSIONS } from '../data/catalog/iv-sessions.js';
import {
  PLAN_ADDON_DISCOUNT,
  PLAN_BILLING_TERMS,
  PLAN_VISIT_CREDIT,
  getPlanBillingTerm,
  planTierDiscountRate,
} from '../config/subscriptionTiers.js';

export const CUSTOM_PLAN_LIMITS = Object.freeze({
  people: 4,
  visitsPerPerson: 4,
  addonLinesPerVisit: 24,
  recurringPeriodDollars: 100000,
});

export function customPlanItemKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function planError(message, code = 'custom_plan_manifest_invalid') {
  return Object.assign(new Error(message), { code, status: 400 });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildTherapyManifest() {
  const map = new Map();
  for (const session of IV_SESSIONS) {
    if (Array.isArray(session.doses) && session.doses.length) {
      for (const dose of session.doses) {
        map.set(dose.key, {
          key: dose.key,
          label: `${session.label} ${dose.label}`,
          price: Number(dose.price),
          protocol: session.key,
        });
      }
      continue;
    }
    map.set(session.key, {
      key: session.key,
      label: session.label,
      price: Number(session.price),
      protocol: session.key,
    });
  }
  return map;
}

function buildAddonManifest(items, { defaultMax = 4, include = () => true } = {}) {
  const map = new Map();
  for (const item of items.filter(include)) {
    const key = customPlanItemKey(item.label);
    map.set(key, {
      key,
      label: item.label,
      price: Number(item.price),
      max: Math.max(1, Math.floor(Number(item.max) || defaultMax)),
    });
  }
  return map;
}

const THERAPIES = buildTherapyManifest();
const IV_PLAN_ADDONS = buildAddonManifest(IV_ADDONS, {
  defaultMax: 4,
  // The builder exposes CBD/NAD as therapies, not as extra plan add-ons.
  include: (item) => !item.group,
});
const IM_PLAN_ADDONS = buildAddonManifest(IM_SHOTS, { defaultMax: 4 });

function normalizeQuantities(value, allowlist, field) {
  if (value == null) return {};
  if (!isRecord(value)) {
    throw planError(`${field} must be an object of stable item keys and quantities.`);
  }
  const entries = Object.entries(value);
  if (entries.length > CUSTOM_PLAN_LIMITS.addonLinesPerVisit) {
    throw planError(`${field} has too many line items.`, 'custom_plan_quantity_invalid');
  }

  const normalized = {};
  for (const [rawKey, rawQuantity] of entries) {
    const key = String(rawKey || '').trim();
    const item = allowlist.get(key);
    if (!item) {
      throw planError(`Unknown plan add-on key: ${key || 'empty'}.`, 'custom_plan_addon_unknown');
    }
    const quantity = Number(rawQuantity);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > item.max) {
      throw planError(
        `${field}.${key} must be a whole number from 0 to ${item.max}.`,
        'custom_plan_quantity_invalid',
      );
    }
    if (quantity > 0) normalized[key] = quantity;
  }
  return normalized;
}

function normalizePlanManifest(rawPlan) {
  const people = Array.isArray(rawPlan)
    ? rawPlan
    : (isRecord(rawPlan) && Array.isArray(rawPlan.people) ? rawPlan.people : null);
  if (!people || people.length < 1 || people.length > CUSTOM_PLAN_LIMITS.people) {
    throw planError(
      `A custom plan requires 1 to ${CUSTOM_PLAN_LIMITS.people} people.`,
      'custom_plan_people_invalid',
    );
  }

  let sessionsPerPerson = null;
  const safePeople = people.map((person, personIndex) => {
    if (!isRecord(person) || !Array.isArray(person.visits)) {
      throw planError(`Person ${personIndex + 1} must have a visits array.`);
    }
    if (person.visits.length < 1 || person.visits.length > CUSTOM_PLAN_LIMITS.visitsPerPerson) {
      throw planError(
        `Each person requires 1 to ${CUSTOM_PLAN_LIMITS.visitsPerPerson} visits.`,
        'custom_plan_visits_invalid',
      );
    }
    if (sessionsPerPerson == null) sessionsPerPerson = person.visits.length;
    if (person.visits.length !== sessionsPerPerson) {
      throw planError('Every person must use the same monthly visit cadence.', 'custom_plan_visits_invalid');
    }

    return {
      visits: person.visits.map((visit, visitIndex) => {
        if (!isRecord(visit)) {
          throw planError(`Visit ${visitIndex + 1} for person ${personIndex + 1} is invalid.`);
        }
        const therapyKey = String(visit.therapyKey || '').trim();
        if (!THERAPIES.has(therapyKey)) {
          throw planError(`Unknown plan therapy key: ${therapyKey || 'empty'}.`, 'custom_plan_therapy_unknown');
        }
        return {
          therapyKey,
          ivQty: normalizeQuantities(visit.ivQty, IV_PLAN_ADDONS, 'ivQty'),
          imQty: normalizeQuantities(visit.imQty, IM_PLAN_ADDONS, 'imQty'),
        };
      }),
    };
  });

  return { people: safePeople, sessionsPerPerson };
}

function addonDetail(quantities, allowlist) {
  return Object.entries(quantities).map(([key, quantity]) => {
    const item = allowlist.get(key);
    return {
      key,
      label: item.label,
      quantity,
      linePriceDollars: item.price * quantity,
    };
  });
}

function providedNumber(input, field) {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return null;
  const number = Number(input[field]);
  if (!Number.isFinite(number)) {
    throw planError(`${field} is invalid.`, 'client_custom_price_mismatch');
  }
  return number;
}

// Older clients included a calculated price/visit count. We may accept an
// exact hint during rollout, but it is never used to calculate the quote. A
// mismatch fails closed before auth or any payment-provider call.
export function assertCustomPlanClientHints(input, quote) {
  if (!isRecord(input)) return;
  const dollarHints = [
    ['price', quote.periodPriceDollars],
    ['priceDollars', quote.periodPriceDollars],
    ['monthlyPrice', quote.monthlyPriceDollars],
  ];
  const centHints = [
    ['priceCents', quote.periodPriceCents],
    ['recurringPriceCents', quote.periodPriceCents],
    ['monthlyPriceCents', quote.monthlyPriceCents],
  ];
  for (const [field, expected] of dollarHints) {
    const value = providedNumber(input, field);
    if (value != null && Math.round(value * 100) !== Math.round(expected * 100)) {
      throw planError('The submitted custom-plan price does not match the server quote.', 'client_custom_price_mismatch');
    }
  }
  for (const [field, expected] of centHints) {
    const value = providedNumber(input, field);
    if (value != null && Math.round(value) !== Math.round(expected)) {
      throw planError('The submitted custom-plan price does not match the server quote.', 'client_custom_price_mismatch');
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, 'visitsPerCycle')) {
    const visits = Number(input.visitsPerCycle);
    if (!Number.isInteger(visits) || visits !== quote.visitsPerCycle) {
      throw planError('The submitted visit count does not match the plan manifest.', 'client_custom_visits_mismatch');
    }
  }
}

export function calculateCustomPlanQuote(input = {}) {
  if (!isRecord(input)) throw planError('Custom plan input must be an object.');
  const term = getPlanBillingTerm(input.billing || input.term);
  if (!term) {
    throw planError(
      `Billing term must be one of: ${Object.keys(PLAN_BILLING_TERMS).join(', ')}.`,
      'custom_plan_billing_invalid',
    );
  }
  const { people: plan, sessionsPerPerson } = normalizePlanManifest(input.plan);
  const tierDiscountRate = planTierDiscountRate(sessionsPerPerson);

  const detailedPeople = plan.map((person, personIndex) => {
    const visits = person.visits.map((visit) => {
      const therapy = THERAPIES.get(visit.therapyKey);
      const ivAddons = addonDetail(visit.ivQty, IV_PLAN_ADDONS);
      const imAddons = addonDetail(visit.imQty, IM_PLAN_ADDONS);
      const addonDollars = [...ivAddons, ...imAddons]
        .reduce((sum, item) => sum + item.linePriceDollars, 0);
      const retailDollars = therapy.price + addonDollars;
      const coveredDollars = Math.min(retailDollars, PLAN_VISIT_CREDIT);
      const upgradeDollars = Math.max(0, retailDollars - PLAN_VISIT_CREDIT);
      return {
        therapyKey: therapy.key,
        therapyLabel: therapy.label,
        protocol: therapy.protocol,
        retailDollars,
        coveredDollars,
        upgradeDollars,
        included: retailDollars <= PLAN_VISIT_CREDIT,
        addons: [...ivAddons, ...imAddons],
      };
    });
    const retailDollars = visits.reduce((sum, visit) => sum + visit.retailDollars, 0);
    const coveredDollars = visits.reduce((sum, visit) => sum + visit.coveredDollars, 0);
    const upgradeDollars = visits.reduce((sum, visit) => sum + visit.upgradeDollars, 0);
    return {
      label: `Person ${personIndex + 1}`,
      visits,
      retailDollars,
      coveredDollars,
      upgradeDollars,
    };
  });

  const monthlyRetailDollars = detailedPeople.reduce((sum, person) => sum + person.retailDollars, 0);
  const monthlyCoveredDollars = detailedPeople.reduce((sum, person) => sum + person.coveredDollars, 0);
  const monthlyUpgradeDollars = detailedPeople.reduce((sum, person) => sum + person.upgradeDollars, 0);
  const monthlySavingsDollars = Math.round(
    monthlyCoveredDollars * tierDiscountRate + monthlyUpgradeDollars * PLAN_ADDON_DISCOUNT,
  );
  const monthlyPriceDollars = Math.max(0, monthlyRetailDollars - monthlySavingsDollars);
  const periodPriceDollars = Math.round(monthlyPriceDollars * term.months * (1 - term.discount));

  if (!(monthlyPriceDollars > 0) || !(periodPriceDollars > 0)) {
    throw planError('The custom plan must have a positive server-derived price.', 'custom_plan_price_invalid');
  }
  if (periodPriceDollars > CUSTOM_PLAN_LIMITS.recurringPeriodDollars) {
    throw planError('The custom plan exceeds the maximum recurring period amount.', 'custom_plan_price_invalid');
  }

  // Per-person display values add back to the canonical total. Price authority
  // remains the aggregate values above; these rows are presentation only.
  let allocatedMonthly = 0;
  const people = detailedPeople.map((person, index) => {
    const provisional = person.retailDollars - Math.round(
      person.coveredDollars * tierDiscountRate + person.upgradeDollars * PLAN_ADDON_DISCOUNT,
    );
    const monthly = index === detailedPeople.length - 1
      ? monthlyPriceDollars - allocatedMonthly
      : provisional;
    allocatedMonthly += monthly;
    return { ...person, monthlyPriceDollars: monthly };
  });

  const peopleCount = plan.length;
  const visitsPerCycle = peopleCount * sessionsPerPerson;
  const planName = `${peopleCount > 1 ? `${peopleCount}-person` : 'Custom'} ${sessionsPerPerson}×`;
  const quote = {
    custom: true,
    id: 'custom',
    plan,
    people,
    peopleCount,
    sessionsPerPerson,
    visitsPerCycle,
    billing: term.billing,
    term: term.key,
    commitmentMonths: term.commitmentMonths,
    termMonths: term.months,
    termDiscount: term.discount,
    tierDiscountRate,
    addonDiscountRate: PLAN_ADDON_DISCOUNT,
    visitCreditDollars: PLAN_VISIT_CREDIT,
    monthlyRetailDollars,
    monthlyCoveredDollars,
    monthlyUpgradeDollars,
    monthlySavingsDollars,
    monthlyPriceDollars,
    monthlyPriceCents: monthlyPriceDollars * 100,
    periodPriceDollars,
    periodPriceCents: periodPriceDollars * 100,
    effectiveMonthlyDollars: Math.round(periodPriceDollars / term.months),
    displayName: `${planName} Plan`,
    planName: `${planName} Plan`,
  };

  assertCustomPlanClientHints(input, quote);
  return quote;
}

export function customPlanPricingSummary(quote) {
  if (!quote?.custom) return null;
  return {
    displayName: quote.displayName,
    billing: quote.billing,
    term: quote.term,
    peopleCount: quote.peopleCount,
    sessionsPerPerson: quote.sessionsPerPerson,
    visitsPerCycle: quote.visitsPerCycle,
    monthlyPriceDollars: quote.monthlyPriceDollars,
    periodPriceDollars: quote.periodPriceDollars,
    effectiveMonthlyDollars: quote.effectiveMonthlyDollars,
  };
}
