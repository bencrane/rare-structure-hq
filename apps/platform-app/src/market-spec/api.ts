/**
 * Market-spec API — client for the live market-definition instrument.
 *
 * VITE_API_BASE_URL base + the Supabase session JWT as Bearer; the BFF
 * (platform-api routes/market-spec.ts) validates the session and proxies
 * verbatim to core-x edge_api's /api/v1/market-spec/* behind the service
 * token. Edge responses come back raw (no `{ data }` envelope).
 *
 * The spec wire shape mirrors the edge compiler exactly: every omitted
 * section means "All". Contactability has no representation here by design.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

// ── Spec wire shape (edge market_spec_v1.compile_spec contract) ──────────────

export type GeoBasis = "hq" | "pop";
export type DollarSide = "total" | "prime" | "sub";
export type DollarWindow = "12mo" | "24mo" | "60mo" | "lifetime";

export type MarketSpec = {
  geo?: { basis?: GeoBasis; states: string[] };
  dollars?: { side?: DollarSide; window?: DollarWindow; min?: number; max?: number };
  designations?: string[];
  firmographics?: { employee_bands: string[] };
};

export interface SpecCount {
  count: number;
  /** Server echo of the compiled spec (normalized tokens). */
  spec: MarketSpec;
  elapsed_ms: number | null;
  artifact: string | null;
}

// ── Vocabularies (frozen; must match the edge compiler's server-side maps) ───

export const DOLLAR_WINDOWS: { value: DollarWindow; label: string }[] = [
  { value: "12mo", label: "past 12 months" },
  { value: "24mo", label: "past 2 years" },
  { value: "60mo", label: "past 5 years" },
  { value: "lifetime", label: "lifetime" },
];

export const DOLLAR_SIDES: { value: DollarSide; label: string }[] = [
  { value: "total", label: "combined (prime + sub)" },
  { value: "prime", label: "prime only" },
  { value: "sub", label: "sub only" },
];

export const DESIGNATION_TOKENS: { value: string; label: string }[] = [
  { value: "in_dsbs", label: "In DSBS" },
  { value: "dsbs_8a", label: "8(a)" },
  { value: "dsbs_hubzone", label: "HUBZone" },
  { value: "dsbs_wosb", label: "WOSB" },
  { value: "dsbs_edwosb", label: "EDWOSB" },
  { value: "dsbs_sdvosb", label: "SDVOSB" },
  { value: "dsbs_vosb", label: "VOSB" },
  { value: "fsrs_any_designation", label: "Any FSRS designation" },
];

/** The spine's actual employee_size_band values (verified live 2026-07-16). */
export const EMPLOYEE_BANDS = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10001+",
] as const;

// ── Client ───────────────────────────────────────────────────────────────────

export async function countMarketSpec(token: string, spec: MarketSpec): Promise<SpecCount> {
  const res = await fetch(`${API_BASE}/api/v1/market-spec/count`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(spec),
  });
  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = (JSON.parse(detail) as { detail?: string }).detail ?? detail;
    } catch {
      // non-JSON error body — surface verbatim
    }
    throw new Error(detail || `market-spec count failed: ${res.status}`);
  }
  return (await res.json()) as SpecCount;
}
