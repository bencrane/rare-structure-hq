/**
 * MedStaffPairs — Medical & Clinical Staffing pair dispositions.
 * Thin wrapper over the shared PairDispositions surface; overrides persist in
 * localStorage `viewer.medstaff-pairs.v1`.
 */
import baked from "@/internal/medstaff-pairs.json";

import { PairDispositions, type PairDispositionsData } from "./PairDispositions";

export function MedStaffPairs() {
  return (
    <PairDispositions
      data={baked as unknown as PairDispositionsData}
      heading="Medical & Clinical Staffing — pair dispositions"
      storageKey="viewer.medstaff-pairs.v1"
      short={{
        "Medical & Clinical Staffing": "MedStaff",
        "Building Services": "Building",
        Out: "Out",
      }}
      catColor={{
        "Medical & Clinical Staffing": "#7a3aa0",
        "Building Services": "#0a7d32",
        Out: "#888888",
      }}
    />
  );
}
