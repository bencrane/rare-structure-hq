/**
 * TranspoPairs — Transportation & Logistics family pair dispositions (Sea ·
 * Air · AvMRO · Whse · Ground). Thin wrapper over the shared PairDispositions
 * surface; overrides persist in localStorage `viewer.transpo-pairs.v1`.
 */
import baked from "@/internal/transpo-pairs.json";

import { PairDispositions, type PairDispositionsData } from "./PairDispositions";

export function TranspoPairs() {
  return (
    <PairDispositions
      data={baked as unknown as PairDispositionsData}
      heading="Transportation & Logistics family — pair dispositions"
      storageKey="viewer.transpo-pairs.v1"
      short={{
        "Sealift & Marine Services": "Sea",
        "Air Charter & Cargo": "Air",
        "Aviation Maintenance & Support": "AvMRO",
        "Warehousing & Distribution": "Whse",
        "Ground Transportation & Freight": "Ground",
        Out: "Out",
      }}
      catColor={{
        "Sealift & Marine Services": "#1a56a0",
        "Air Charter & Cargo": "#7a3aa0",
        "Aviation Maintenance & Support": "#b03030",
        "Warehousing & Distribution": "#a05a00",
        "Ground Transportation & Freight": "#0a7d32",
        Out: "#888888",
      }}
    />
  );
}
