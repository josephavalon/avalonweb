export const DEFAULT_DEPOSIT_AMOUNT_CENTS = 5000;

export function getDepositAmountCents(env = {}) {
  const raw = env.DEPOSIT_AMOUNT_CENTS ?? env.VITE_DEPOSIT_AMOUNT_CENTS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DEPOSIT_AMOUNT_CENTS;
}

export function getDepositAmountDollars(env = {}) {
  return getDepositAmountCents(env) / 100;
}
