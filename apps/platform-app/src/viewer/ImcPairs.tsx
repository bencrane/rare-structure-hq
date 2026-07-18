/**
 * ImcPairs — Industrial Machinery & Components Manufacturing pair dispositions.
 * Thin wrapper over the shared PairDispositions surface; overrides persist in
 * localStorage `viewer.imc-pairs.v1`.
 */
import baked from "@/internal/imc-pairs.json";

import { PairDispositions, type PairDispositionsData } from "./PairDispositions";

export function ImcPairs() {
  return (
    <PairDispositions
      data={baked as unknown as PairDispositionsData}
      heading="Industrial Machinery & Components — pair dispositions"
      storageKey="viewer.imc-pairs.v1"
      short={{ "Industrial Machinery & Components Manufacturing": "IMC", Out: "Out" }}
      catColor={{ "Industrial Machinery & Components Manufacturing": "#1a56a0", Out: "#888888" }}
    />
  );
}
