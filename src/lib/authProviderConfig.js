function envFlag(name, fallback = false) {
  const value = String(import.meta.env?.[name] ?? '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

export const authProviderConfig = {
  google: envFlag('VITE_AUTH_GOOGLE_ENABLED'),
  apple: envFlag('VITE_AUTH_APPLE_ENABLED'),
  phone: envFlag('VITE_AUTH_PHONE_ENABLED'),
  passkey: envFlag('VITE_AUTH_PASSKEY_ENABLED'),
};

export const socialAuthEnabled = authProviderConfig.google || authProviderConfig.apple;
