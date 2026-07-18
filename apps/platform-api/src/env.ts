/**
 * Runtime settings for platform-api. Values come from Doppler project
 * `hq-rare-structure-hq` config `prd` (see ../doppler.yaml).
 *
 * Naming convention: `HQX_*` for the hq-x Supabase project keys,
 * `COREX_*` for the core-x catalyst_api bridge (award-profile/dossier/map
 * surfaces), `CATALYST_*` for the same catalyst_api upstream as consumed by
 * the market brokers (market-spec, market-collections, federal Q1 typeahead).
 * Both name pairs point at catalyst_api and both are set in Doppler prd;
 * collapsing them into one name requires a coordinated Doppler change and is
 * deliberately NOT done here.
 *
 * PORT lives at the Railway layer — NOT in Doppler. Read separately
 * from process.env.PORT with a local-dev default of 8000.
 */

import { z } from "zod";

const envSchema = z.object({
  HQX_SUPABASE_URL: z.string().url(),
  HQX_SUPABASE_JWKS_URL: z.string().url(),
  HQX_SUPABASE_ISSUER: z.string().url(),
  HQX_SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Gen-3 core-x catalyst_api — the BFF's data bridge for federal award profiles.
  COREX_API_URL: z.string().url(),
  COREX_SERVICE_TOKEN: z.string().min(1),
  // Same catalyst_api upstream under the market-broker name pair (see header).
  // Trailing slash stripped so route modules can concatenate paths directly.
  CATALYST_API_URL: z
    .string()
    .url()
    .transform((u) => u.replace(/\/$/, "")),
  CATALYST_API_TOKEN: z.string().min(1),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  APP_ENV: z.enum(["prd", "stg", "dev"]),
});

const parsed = envSchema.safeParse({
  HQX_SUPABASE_URL: process.env.HQX_SUPABASE_URL,
  HQX_SUPABASE_JWKS_URL: process.env.HQX_SUPABASE_JWKS_URL,
  HQX_SUPABASE_ISSUER: process.env.HQX_SUPABASE_ISSUER,
  HQX_SUPABASE_SERVICE_ROLE_KEY: process.env.HQX_SUPABASE_SERVICE_ROLE_KEY,
  COREX_API_URL: process.env.COREX_API_URL,
  COREX_SERVICE_TOKEN: process.env.COREX_SERVICE_TOKEN,
  CATALYST_API_URL: process.env.CATALYST_API_URL,
  CATALYST_API_TOKEN: process.env.CATALYST_API_TOKEN,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  APP_ENV: process.env.APP_ENV,
});

if (!parsed.success) {
  console.error("platform-api: env validation failed");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const allowedOrigins: string[] = env.ALLOWED_ORIGINS.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
