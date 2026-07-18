/**
 * TextilesPairs — Clothing & Textiles pair dispositions.
 * Thin wrapper over the shared PairDispositions surface; overrides persist in
 * localStorage `viewer.textiles-pairs.v1`.
 */
import baked from "@/internal/textiles-pairs.json";

import { PairDispositions, type PairDispositionsData } from "./PairDispositions";

export function TextilesPairs() {
  return (
    <PairDispositions
      data={baked as unknown as PairDispositionsData}
      heading="Clothing & Textiles — pair dispositions"
      storageKey="viewer.textiles-pairs.v1"
      short={{ "Clothing & Textiles": "C&T", Out: "Out" }}
      catColor={{ "Clothing & Textiles": "#7a3aa0", Out: "#888888" }}
    />
  );
}
