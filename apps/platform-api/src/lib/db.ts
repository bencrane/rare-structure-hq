/**
 * Supabase service-role client for platform-api.
 *
 * Server-only: the SERVICE-ROLE key bypasses RLS. It must NEVER reach the
 * browser. Constructed lazily (like lib/anvil.ts) so the BFF still boots when
 * Supabase env is absent — only the proposal-store routes then fail, loudly.
 *
 * Reads the LIVE `HQX_*` Supabase creds (the hq-x project). The legacy `RSH_*`
 * keys are stale and deliberately unused (RSH_DB_URL_POOLED password rotated).
 */
import { type SupabaseClient, createClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.HQX_SUPABASE_URL;
  const key = process.env.HQX_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase not configured — set HQX_SUPABASE_URL and HQX_SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
