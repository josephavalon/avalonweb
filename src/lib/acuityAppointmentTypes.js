const typeIds = {
  default: import.meta.env.VITE_ACUITY_DEFAULT_TYPE_ID || '',
  hydration: import.meta.env.VITE_ACUITY_TYPE_HYDRATION || '',
  myers: import.meta.env.VITE_ACUITY_TYPE_MYERS || '',
  energy: import.meta.env.VITE_ACUITY_TYPE_ENERGY || '',
  immunity: import.meta.env.VITE_ACUITY_TYPE_IMMUNITY || '',
  beauty: import.meta.env.VITE_ACUITY_TYPE_BEAUTY || '',
  recovery: import.meta.env.VITE_ACUITY_TYPE_RECOVERY || '',
  hangover: import.meta.env.VITE_ACUITY_TYPE_HANGOVER || '',
  jetlag: import.meta.env.VITE_ACUITY_TYPE_JETLAG || '',
  nad: import.meta.env.VITE_ACUITY_TYPE_IV_NAD || '',
  cbd: import.meta.env.VITE_ACUITY_TYPE_IV_CBD || '',
  im: import.meta.env.VITE_ACUITY_TYPE_IM_SHOTS || '',
  subscription: import.meta.env.VITE_ACUITY_TYPE_MEMBERSHIP || '',
  event: import.meta.env.VITE_ACUITY_TYPE_EVENT || '',
  eventPresale: import.meta.env.VITE_ACUITY_TYPE_EVENT_PRESALE || '',
};

const protocolAliases = {
  dehydration: 'hydration',
  postnight: 'hangover',
  'post-night-out': 'hangover',
  jet_lag: 'jetlag',
  'jet-lag': 'jetlag',
  nad_250: 'nad',
  nad_500: 'nad',
  nad_750: 'nad',
  nad_1000: 'nad',
  nad_1250: 'nad',
  nad_1500: 'nad',
  cbd_low: 'cbd',
  cbd_high: 'cbd',
  cbd_33: 'cbd',
  cbd_66: 'cbd',
  exosomes: 'default',
};

function normalizeKey(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\+/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function acuityTypeForProtocol(protocolKey, doseKey) {
  const key = normalizeKey(doseKey || protocolKey);
  const aliased = protocolAliases[key] || key;
  return typeIds[aliased] || typeIds.default;
}

export function acuityTypeForCart(items = [], membership = null) {
  if (membership) return typeIds.subscription || typeIds.default;

  const primary = items.find((item) => item.type === 'iv') || items[0];
  if (!primary) return typeIds.default;
  if (primary.type === 'im') return typeIds.im || typeIds.default;

  const haystack = `${primary.cartKey || primary.key || ''} ${primary.label || ''}`.toLowerCase();
  if (haystack.includes('nad')) return typeIds.nad || typeIds.default;
  if (haystack.includes('cbd')) return typeIds.cbd || typeIds.default;
  if (haystack.includes('hydration')) return typeIds.hydration || typeIds.default;
  if (haystack.includes('myers')) return typeIds.myers || typeIds.default;
  if (haystack.includes('energy')) return typeIds.energy || typeIds.default;
  if (haystack.includes('immunity')) return typeIds.immunity || typeIds.default;
  if (haystack.includes('beauty')) return typeIds.beauty || typeIds.default;
  if (haystack.includes('recovery')) return typeIds.recovery || typeIds.default;
  if (haystack.includes('jet')) return typeIds.jetlag || typeIds.default;
  if (haystack.includes('postnight') || haystack.includes('night')) return typeIds.hangover || typeIds.default;

  return acuityTypeForProtocol(primary.cartKey || primary.key || primary.label);
}
