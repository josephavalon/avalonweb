export function payOpsFinanceCoreEnabled(env = import.meta.env) {
  return String(env?.VITE_PAYOPS_FINANCE_CORE_ENABLED || '').trim().toLowerCase() === 'true';
}

// Browser visibility only. Server-side PayOps, ledger, and inventory-cost
// mutation flags remain independent and must pass their own release gates.
export const PAYOPS_FINANCE_CORE_ENABLED = payOpsFinanceCoreEnabled();
