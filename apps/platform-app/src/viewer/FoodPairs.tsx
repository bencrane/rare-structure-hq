/**
 * FoodPairs — Food Production pair dispositions.
 * Thin wrapper over the shared PairDispositions surface; overrides persist in
 * localStorage `viewer.food-pairs.v1`.
 */
import baked from "@/internal/food-pairs.json";

import { PairDispositions, type PairDispositionsData } from "./PairDispositions";

export function FoodPairs() {
  return (
    <PairDispositions
      data={baked as unknown as PairDispositionsData}
      heading="Food Production — pair dispositions"
      storageKey="viewer.food-pairs.v1"
      short={{ "Food Production": "Food", Out: "Out" }}
      catColor={{ "Food Production": "#0a7d32", Out: "#888888" }}
    />
  );
}
