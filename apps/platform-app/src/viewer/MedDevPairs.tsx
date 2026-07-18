/**
 * MedDevPairs — Medical Devices & Supplies Manufacturing pair dispositions.
 * Thin wrapper over the shared PairDispositions surface; overrides persist in
 * localStorage `viewer.meddev-pairs.v1`.
 */
import baked from "@/internal/meddev-pairs.json";

import { PairDispositions, type PairDispositionsData } from "./PairDispositions";

export function MedDevPairs() {
  return (
    <PairDispositions
      data={baked as unknown as PairDispositionsData}
      heading="Medical Devices & Supplies Manufacturing — pair dispositions"
      storageKey="viewer.meddev-pairs.v1"
      short={{ "Medical Devices & Supplies Manufacturing": "MedDev", Out: "Out" }}
      catColor={{ "Medical Devices & Supplies Manufacturing": "#1a56a0", Out: "#888888" }}
    />
  );
}
