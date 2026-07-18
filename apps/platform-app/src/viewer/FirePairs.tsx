/**
 * FirePairs — Wildland Fire & Forestry Services pair dispositions.
 * Thin wrapper over the shared PairDispositions surface; overrides persist in
 * localStorage `viewer.fire-pairs.v1`.
 */
import baked from "@/internal/fire-pairs.json";

import { PairDispositions, type PairDispositionsData } from "./PairDispositions";

export function FirePairs() {
  return (
    <PairDispositions
      data={baked as unknown as PairDispositionsData}
      heading="Wildland Fire & Forestry Services — pair dispositions"
      storageKey="viewer.fire-pairs.v1"
      short={{ "Wildland Fire & Forestry Services": "Fire", Out: "Out" }}
      catColor={{ "Wildland Fire & Forestry Services": "#b03030", Out: "#888888" }}
    />
  );
}
