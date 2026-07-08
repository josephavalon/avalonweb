/**
 * Wallet helpers. Every mutation goes through apply_wallet_transaction (the
 * SECURITY DEFINER RPC in migration 036_wallets.sql) so the balance update and
 * the audit row commit as one atomic write.
 *
 * PHI LAW: wallet balances are financial, not clinical — safe to log
 * balance/delta at debug level; never log the profile_id in cleartext next to
 * PHI-adjacent booking metadata.
 */

/**
 * Read the wallet balance for a profile. Returns 0 when no wallet row exists
 * yet (wallets are created lazily on first credit).
 */
export async function readWalletBalance(db, profileId) {
  const { data, error } = await db
    .from('wallets')
    .select('id, balance_cents')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { walletId: null, balanceCents: 0 };
  return { walletId: data.id, balanceCents: data.balance_cents };
}

/**
 * Apply a wallet delta atomically via the RPC. Returns the new balance.
 * Positive deltaCents = credit, negative = debit. The DB CHECK prevents the
 * balance from going below zero — pass a debit ≤ current balance.
 *
 * kind must match the check constraint in 036_wallets.sql:
 *   admin_credit | admin_debit | subscription_credit | booking_debit
 *   booking_refund | promo_credit | gift_card_credit | adjustment
 *
 * idempotencyKey is unique-indexed — reuse the same key across retries to make
 * webhook handlers safe (invoice.paid, payment_intent.succeeded).
 */
export async function applyWalletDelta(db, {
  profileId,
  deltaCents,
  kind,
  actorAdminId = null,
  idempotencyKey = null,
  metadata = {},
}) {
  if (!profileId) throw new Error('profileId required');
  if (!Number.isInteger(deltaCents) || deltaCents === 0) {
    throw new Error('deltaCents must be a non-zero integer');
  }
  const { data, error } = await db.rpc('apply_wallet_transaction', {
    p_profile_id: profileId,
    p_delta_cents: deltaCents,
    p_kind: kind,
    p_actor_admin_id: actorAdminId,
    p_idempotency: idempotencyKey,
    p_metadata: metadata,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('apply_wallet_transaction returned no row');
  return {
    walletId: row.wallet_id,
    balanceCents: row.balance_cents,
    transactionId: row.transaction_id,
    alreadyApplied: Boolean(row.already_applied),
  };
}

/**
 * Split a booking amount into (walletCents, cardCents). If the wallet covers
 * the whole thing, cardCents is 0 and we skip Stripe entirely. Pure — safe to
 * test without a DB.
 */
export function splitBookingAmount(totalCents, walletBalanceCents, useWallet) {
  if (!useWallet || walletBalanceCents <= 0) return { walletCents: 0, cardCents: totalCents };
  const walletCents = Math.min(totalCents, walletBalanceCents);
  const cardCents = totalCents - walletCents;
  return { walletCents, cardCents };
}
