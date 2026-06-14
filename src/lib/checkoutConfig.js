import { ONE_TIME_APPOINTMENT_DEPOSIT_DOLLARS } from './paymentRules';

export const DEFAULT_DEDUCTIBLE_AMOUNT_CENTS = ONE_TIME_APPOINTMENT_DEPOSIT_DOLLARS * 100;
export const DEFAULT_DEPOSIT_AMOUNT_CENTS = DEFAULT_DEDUCTIBLE_AMOUNT_CENTS;

export function getDepositAmountCents() {
  return DEFAULT_DEPOSIT_AMOUNT_CENTS;
}

export function getDepositAmountDollars() {
  return getDepositAmountCents() / 100;
}
