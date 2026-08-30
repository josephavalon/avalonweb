const AAL1 = 'aal1';
const AAL2 = 'aal2';

function normalizeLevel(value) {
  const level = String(value || '').trim().toLowerCase();
  return level === AAL1 || level === AAL2 ? level : null;
}

function unavailableState(enforced) {
  return {
    status: enforced ? 'assurance_unavailable' : 'not_enforced',
    required: enforced,
    verified: false,
    method: 'supabase_mfa_assurance',
    currentLevel: null,
    nextLevel: null,
    reason: enforced
      ? 'Supabase MFA assurance could not be verified. Privileged access remains gated.'
      : 'MFA enforcement is disabled for this environment.',
  };
}

/**
 * Convert Supabase's supported Authenticator Assurance Level response into the
 * stable user.mfa shape consumed by RequireAuth. This function intentionally
 * never examines the Supabase User object: AAL/AMR are session properties and
 * must come from auth.mfa.getAuthenticatorAssuranceLevel().
 */
export function mfaStateFromAuthenticatorAssurance(data, { enforced = false } = {}) {
  const currentLevel = normalizeLevel(data?.currentLevel);
  const nextLevel = normalizeLevel(data?.nextLevel);
  if (!currentLevel) return unavailableState(Boolean(enforced));

  const verified = currentLevel === AAL2;
  let status = 'not_enforced';
  if (verified) status = 'verified';
  else if (enforced && nextLevel === AAL2) status = 'challenge_required';
  else if (enforced) status = 'enrollment_required';

  return {
    status,
    required: Boolean(enforced),
    verified,
    method: 'supabase_mfa_assurance',
    currentLevel,
    nextLevel,
    reason: verified
      ? 'Supabase reports an AAL2 session.'
      : enforced
        ? (nextLevel === AAL2
            ? 'A verified factor is available and must be challenged.'
            : 'A second factor must be enrolled before privileged access.')
        : 'MFA enforcement is disabled for this environment.',
  };
}

/**
 * Read client assurance through the supported Supabase MFA API. Failures become
 * an explicit state rather than throwing: this avoids breaking ordinary login
 * while still failing privileged access closed whenever enforcement is on.
 */
export async function readSupabaseMfaAssurance(client, { enforced = false } = {}) {
  const getAssurance = client?.auth?.mfa?.getAuthenticatorAssuranceLevel;
  if (typeof getAssurance !== 'function') return unavailableState(Boolean(enforced));
  try {
    const { data, error } = await getAssurance.call(client.auth.mfa);
    if (error) return unavailableState(Boolean(enforced));
    return mfaStateFromAuthenticatorAssurance(data, { enforced });
  } catch {
    return unavailableState(Boolean(enforced));
  }
}
