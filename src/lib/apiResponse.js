function objectAt(value, path) {
  return String(path || '').split('.').filter(Boolean).reduce(
    (current, key) => (current && typeof current === 'object' && !Array.isArray(current) ? current[key] : undefined),
    value,
  );
}

export function isResponseObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function invalidApiResponse(message = 'The connected service returned an invalid response.') {
  const error = new Error(message);
  error.status = 502;
  error.body = { code: 'invalid_api_response' };
  return error;
}

/**
 * Treat a 2xx response as verified only when its operational fields have the
 * expected JSON types. This prevents a proxy, partial deploy, or stale API
 * version from turning missing data into a false empty queue or enabling
 * actions against an unverified source.
 */
export function assertApiResponse(value, contract = {}, message) {
  if (!isResponseObject(value)) throw invalidApiResponse(message);

  const checks = [
    ['arrays', Array.isArray],
    ['objects', isResponseObject],
    ['booleans', (field) => typeof field === 'boolean'],
    ['numbers', (field) => typeof field === 'number' && Number.isFinite(field)],
    ['strings', (field) => typeof field === 'string'],
  ];

  for (const [name, predicate] of checks) {
    for (const path of contract[name] || []) {
      if (!predicate(objectAt(value, path))) throw invalidApiResponse(message);
    }
  }

  for (const path of contract.nullableObjects || []) {
    const field = objectAt(value, path);
    if (field !== null && !isResponseObject(field)) throw invalidApiResponse(message);
  }

  return value;
}

export function hasObjectRows(rows, requiredKeys = ['id']) {
  return Array.isArray(rows) && rows.every((row) => (
    isResponseObject(row)
    && requiredKeys.every((key) => {
      const value = row[key];
      return typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined;
    })
  ));
}
