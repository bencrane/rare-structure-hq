/**
 * StaffingPairs — Professional staffing family pair dispositions (IT · Eng ·
 * PM · Admin). Thin wrapper over the shared PairDispositions surface;
 * overrides persist in localStorage `viewer.staffing-pairs.v1`.
 */
import baked from "@/internal/staffing-pairs.json";

import { PairDispositions, type PairDispositionsData } from "./PairDispositions";

export function StaffingPairs() {
  return (
    <PairDispositions
      data={baked as unknown as PairDispositionsData}
      heading="Professional staffing family — pair dispositions"
      storageKey="viewer.staffing-pairs.v1"
      short={{
        "Federal IT Staffing": "IT",
        "Engineering & Technical Staffing": "Eng",
        "Program & Management Support Staffing": "PM",
        "Administrative & Office Support Staffing": "Admin",
        Out: "Out",
      }}
      catColor={{
        "Federal IT Staffing": "#1a56a0",
        "Engineering & Technical Staffing": "#0a7d32",
        "Program & Management Support Staffing": "#7a3aa0",
        "Administrative & Office Support Staffing": "#a05a00",
        Out: "#888888",
      }}
    />
  );
}
