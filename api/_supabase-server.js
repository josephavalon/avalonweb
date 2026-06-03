let supabaseClient = null;

export async function getSupabaseServiceClient() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  supabaseClient = createClient(url, key, { auth: { persistSession: false } });
  return supabaseClient;
}

export async function getDefaultTenantId(db) {
  if (!db) return null;
  const { data } = await db.from('tenants').select('id').eq('slug', 'avalon-vitality').maybeSingle();
  return data?.id || null;
}
