/**
 * WasteEnvPairs — pair dispositions for the two waste/environmental buckets
 * (Waste Management & Sanitation · Environmental Remediation & Services).
 * Thin wrapper over the shared PairDispositions surface; overrides persist in
 * localStorage `viewer.waste-env-pairs.v1`.
 */
import baked from "@/internal/waste-env-pairs.json";

import { PairDispositions, type PairDispositionsData } from "./PairDispositions";

export function WasteEnvPairs() {
  return (
    <PairDispositions
      data={baked as unknown as PairDispositionsData}
      heading="Waste & Environmental — pair dispositions"
      storageKey="viewer.waste-env-pairs.v1"
      short={{
        "Waste Management & Sanitation": "Waste",
        "Environmental Remediation & Services": "EnvRem",
        Out: "Out",
      }}
      catColor={{
        "Waste Management & Sanitation": "#1a56a0",
        "Environmental Remediation & Services": "#0a7d32",
        Out: "#888888",
      }}
    />
  );
}
