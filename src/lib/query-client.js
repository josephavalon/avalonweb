// Deprecated — Auth/query bloat was stripped on 2026-04-22.
// Kept as an empty shim so any stray import resolves without crashing.
// Re-install @tanstack/react-query when the members-only dashboard ships.
export const queryClientInstance = {
  invalidateQueries: () => {},
  getQueryData: () => undefined,
  setQueryData: () => {},
};
