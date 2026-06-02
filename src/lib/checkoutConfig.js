export const DEFAULT_DEDUCTIBLE_AMOUNT_CENTS = 100;
export const DEFAULT_DEPOSIT_AMOUNT_CENTS = DEFAULT_DEDUCTIBLE_AMOUNT_CENTS;

export function getDepositAmountCents() {
  return DEFAULT_DEPOSIT_AMOUNT_CENTS;
}

export function getDepositAmountDollars() {
  return getDepositAmountCents() / 100;
}
