/**
 * Temporary containment for the legacy static-secret Qualiphy callback.
 * Production is denied even if an operator accidentally enables the flag.
 * Replace this helper when a provider-native signed, replay-safe adapter ships.
 */
export function legacyQualiphyMutationEnabled(env = process.env) {
  const enabled = ['true', '1', 'yes'].includes(String(env.QUALIPHY_LEGACY_WEBHOOK_MUTATIONS_ENABLED || '').trim().toLowerCase());
  const nodeEnvironment = String(env.NODE_ENV || '').trim().toLowerCase();
  const vercelEnvironment = String(env.VERCEL_ENV || '').trim().toLowerCase();
  const localRuntime = nodeEnvironment === 'development' || nodeEnvironment === 'test';
  const localDeployment = !vercelEnvironment || vercelEnvironment === 'development';
  return enabled && localRuntime && localDeployment;
}
