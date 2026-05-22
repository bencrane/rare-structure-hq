/**
 * Runtime settings for platform-api. Values come from Doppler project
 * `hq-rare-structure-hq` config `prd` (see ../doppler.yaml).
 *
 * Naming convention: `RSH_*` for server-side rare-structure-hq keys
 * (mirrors `DEX_*` / `HQX_*` / `EW_*` for other platforms).
 *
 * PORT lives at the Railway layer — NOT in Doppler. Read separately
 * from process.env.PORT with a local-dev default of 8000.
 */

import { z } from "zod";

const envSchema = z.object({
  RSH_SUPABASE_URL: z.string().url(),
  RSH_SUPABASE_JWKS_URL: z.string().url(),
  RSH_SUPABASE_ISSUER: z.string().url(),
  RSH_SUPABASE_ANON_KEY: z.string().min(1),
  RSH_SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DEX_BASE_URL: z.string().url(),
  DEX_SERVICE_TOKEN: z.string().min(1),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  APP_ENV: z.enum(["prd", "stg", "dev"]),
});

function pickAlias(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

const parsed = envSchema.safeParse({
  RSH_SUPABASE_URL: process.env.RSH_SUPABASE_URL,
  RSH_SUPABASE_JWKS_URL: process.env.RSH_SUPABASE_JWKS_URL,
  RSH_SUPABASE_ISSUER: process.env.RSH_SUPABASE_ISSUER,
  RSH_SUPABASE_ANON_KEY: process.env.RSH_SUPABASE_ANON_KEY,
  RSH_SUPABASE_SERVICE_ROLE_KEY: process.env.RSH_SUPABASE_SERVICE_ROLE_KEY,
  DEX_BASE_URL: process.env.DEX_BASE_URL,
  // tolerate DEX_SERVICE_TOKEN_ trailing-underscore variant
  DEX_SERVICE_TOKEN: pickAlias("DEX_SERVICE_TOKEN", "DEX_SERVICE_TOKEN_"),
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
