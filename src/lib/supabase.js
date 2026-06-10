import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If creds are absent (local dev without .env.local), supabase is null.
// useInventoryData falls back to seed data automatically.
// experimental.passkey enables signInWithPasskey()/registerPasskey() (WebAuthn).
export const supabase   = (SUPABASE_URL && SUPABASE_ANON)
  ? createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { experimental: { passkey: true } },
    })
  : null;

export const hasSupabase = !!supabase;
