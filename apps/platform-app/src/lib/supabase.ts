/**
 * Supabase client + session helpers.
 *
 * The platform-app authenticates against the rare-structure-hq Supabase
 * project (today that's the hq-x project — the prototype-to-product
 * reuse path). The BFF validates the access_token via JWKS and DEX
 * trusts the same JWT downstream, so a single session covers the whole
 * call chain.
 *
 * Vite bakes `VITE_*` env at build time; missing values surface as a
 * loud warning in the console rather than a silent fall-through.
 */
import { createClient } from "@supabase/supabase-js";

// Prefer the LIVE hq-x creds (VITE_HQX_*); the legacy VITE_SUPABASE_* values are
// stale (the project rotated to the new publishable-key system). The publishable
// key (`sb_publishable_…`) is the client-side key in the new scheme.
const SUPABASE_URL = (import.meta.env.VITE_HQX_SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL) as
  | string
  | undefined;
const SUPABASE_ANON_KEY = (import.meta.env.VITE_HQX_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "platform-app: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing at build time — auth will fail.",
  );
}

export const supabase = createClient(
  SUPABASE_URL ?? "https://invalid.invalid",
  SUPABASE_ANON_KEY ?? "invalid",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
