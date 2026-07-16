import { describe, expect, test } from "bun:test";

import { EMPTY_SPEC_DRAFT, type SpecDraft, buildSpec } from "./MarketSpecForm";

const draft = (patch: Partial<SpecDraft>): SpecDraft => ({ ...EMPTY_SPEC_DRAFT, ...patch });

describe("buildSpec", () => {
  test("empty draft compiles to All (empty spec)", () => {
    expect(buildSpec(EMPTY_SPEC_DRAFT)).toEqual({});
  });

  test("states parse to geo with the selected basis", () => {
    expect(buildSpec(draft({ states: "tx, ok la" }))).toEqual({
      geo: { basis: "hq", states: ["TX", "OK", "LA"] },
    });
    expect(buildSpec(draft({ geoBasis: "pop", states: "CA" }))).toEqual({
      geo: { basis: "pop", states: ["CA"] },
    });
  });

  test("geo basis alone (no states) is still All", () => {
    expect(buildSpec(draft({ geoBasis: "pop" }))).toEqual({});
  });

  test("dollar shorthand + window/side ride only when a bound is set", () => {
    expect(buildSpec(draft({ dollarMin: "250k" }))).toEqual({
      dollars: { side: "total", window: "24mo", min: 250_000 },
    });
    expect(
      buildSpec(draft({ dollarSide: "prime", dollarWindow: "lifetime", dollarMax: "1.5m" })),
    ).toEqual({ dollars: { side: "prime", window: "lifetime", max: 1_500_000 } });
    expect(buildSpec(draft({ dollarSide: "sub", dollarWindow: "12mo" }))).toEqual({});
  });

  test("designations and employee bands pass through when selected", () => {
    expect(
      buildSpec(draft({ designations: ["dsbs_8a"], employeeBands: ["1-10", "11-50"] })),
    ).toEqual({
      designations: ["dsbs_8a"],
      firmographics: { employee_bands: ["1-10", "11-50"] },
    });
  });
});
